import { z } from "zod";
import { recordAudit } from "@/lib/audit";
import type { AuthContext } from "@/lib/authz/guard";
import { requireClient } from "@/lib/authz/guard";
import { parseWallInput } from "@/lib/calendar/month";
import { ForbiddenError, NotFoundError, ValidationError } from "@/lib/errors";
import { createIntervention } from "@/server/services/interventions";

export const APPOINTMENT_MODES = ["office", "client_site", "phone", "video"] as const;
export const APPOINTMENT_STATUSES = ["scheduled", "done", "cancelled", "no_show"] as const;

/**
 * Rendez-vous du cabinet.
 *
 * Les horaires sont des heures murales : la saisie est relue en UTC sans
 * conversion (voir `lib/calendar/month.ts`), sinon le même formulaire donnerait
 * deux horaires selon la machine qui l'exécute.
 */
const wallDateTime = z
  .string()
  .trim()
  .min(1, "Date et heure requises.")
  .transform((value, ctx) => {
    const parsed = parseWallInput(value);
    if (!parsed) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Date et heure invalides." });
      return z.NEVER;
    }
    return parsed;
  });

const optional = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => (v === "" ? undefined : v));

const appointmentSchema = z.object({
  clientId: z.string().min(1, "Choisissez le client attendu."),
  title: z.string().trim().min(2, "Objet du rendez-vous requis.").max(160),
  startsAt: wallDateTime,
  durationMinutes: z.coerce.number().int().min(5).max(600).default(30),
  mode: z.enum(APPOINTMENT_MODES).default("office"),
  location: optional(200),
  preparation: optional(2000),
  assignedToId: optional(40),
});

/** Rendez-vous d'une plage, pour la grille du mois comme pour une journée. */
export async function listAppointments(
  ctx: AuthContext,
  filters: { from?: Date; to?: Date; clientId?: string; assignedToId?: string; status?: string } = {},
) {
  const where: Record<string, unknown> = {};
  if (filters.from || filters.to) {
    where.startsAt = {
      ...(filters.from ? { gte: filters.from } : {}),
      ...(filters.to ? { lt: filters.to } : {}),
    };
  }
  if (filters.clientId) where.clientId = filters.clientId;
  if (filters.assignedToId) where.assignedToId = filters.assignedToId;
  if (filters.status && filters.status !== "all") where.status = filters.status;

  return ctx.db.appointment.findMany({
    where,
    orderBy: { startsAt: "asc" },
    include: {
      client: { select: { id: true, legalName: true } },
      assignedTo: { select: { id: true, name: true } },
    },
  });
}

/**
 * Rendez-vous passés restés « prévus ».
 *
 * Le retard n'est pas un statut stocké : il se déduit de l'heure. Sans cette
 * liste, un rendez-vous honoré mais jamais validé disparaîtrait simplement du
 * passé du calendrier, et son compte rendu ne serait jamais écrit.
 */
export async function listAwaitingReview(ctx: AuthContext, now = new Date(), limit = 20) {
  return ctx.db.appointment.findMany({
    where: { status: "scheduled", startsAt: { lt: now } },
    orderBy: { startsAt: "asc" },
    take: limit,
    include: {
      client: { select: { id: true, legalName: true } },
      assignedTo: { select: { id: true, name: true } },
    },
  });
}

export async function createAppointment(ctx: AuthContext, input: unknown) {
  const data = appointmentSchema.parse(input);
  await requireClient(ctx, data.clientId);
  await assertAssignee(ctx, data.assignedToId);

  const created = await ctx.db.appointment.create({
    data: {
      cabinetId: ctx.cabinet.id,
      clientId: data.clientId,
      title: data.title,
      startsAt: data.startsAt,
      durationMinutes: data.durationMinutes,
      mode: data.mode,
      location: data.location ?? null,
      preparation: data.preparation ?? null,
      assignedToId: data.assignedToId ?? null,
      createdById: ctx.user.id,
      status: "scheduled",
    },
  });

  await Promise.all([
    recordAudit({
      action: "appointment.created",
      cabinetId: ctx.cabinet.id,
      userId: ctx.user.id,
      resourceType: "Appointment",
      resourceId: created.id,
      metadata: { clientId: data.clientId, startsAt: data.startsAt.toISOString() },
      ip: ctx.ip,
      userAgent: ctx.userAgent,
    }),
    ctx.db.activity.create({
      data: {
        cabinetId: ctx.cabinet.id,
        clientId: data.clientId,
        actorId: ctx.user.id,
        type: "appointment.created",
        summary: `Rendez-vous prévu : ${data.title}`,
      },
    }),
  ]);

  return created;
}

export async function updateAppointment(ctx: AuthContext, appointmentId: string, input: unknown) {
  const existing = await find(ctx, appointmentId);
  // Le client n'est pas modifiable : déplacer un rendez-vous d'un dossier à
  // l'autre réécrirait le planning de deux clients d'un seul geste.
  const data = appointmentSchema.parse({ ...(input as object), clientId: existing.clientId });
  await assertAssignee(ctx, data.assignedToId);

  const updated = await ctx.db.appointment.update({
    where: { id: appointmentId },
    data: {
      title: data.title,
      startsAt: data.startsAt,
      durationMinutes: data.durationMinutes,
      mode: data.mode,
      location: data.location ?? null,
      preparation: data.preparation ?? null,
      assignedToId: data.assignedToId ?? null,
    },
  });

  await recordAudit({
    action: "appointment.updated",
    cabinetId: ctx.cabinet.id,
    userId: ctx.user.id,
    resourceType: "Appointment",
    resourceId: appointmentId,
    ip: ctx.ip,
    userAgent: ctx.userAgent,
  });

  return updated;
}

const completeSchema = z.object({
  outcome: z.string().trim().min(2, "Notez ce qui a été fait pendant le rendez-vous.").max(4000),
  reason: optional(500),
});

/**
 * Valide un rendez-vous honoré et le verse à la liste d'activité du client.
 *
 * C'est le point de tout le dispositif : le compte rendu ne reste pas dans le
 * calendrier, où plus personne ne le relirait, il devient une ligne du registre
 * du dossier. La ligne créée est retenue, pour ne pas en écrire deux si la
 * validation est rejouée.
 */
export async function completeAppointment(ctx: AuthContext, appointmentId: string, input: unknown) {
  const existing = await find(ctx, appointmentId);
  if (existing.status === "done") {
    throw new ValidationError("Ce rendez-vous a déjà été validé.");
  }
  const data = completeSchema.parse(input);

  const intervention = await createIntervention(ctx, {
    clientId: existing.clientId,
    service: existing.title,
    performedAt: existing.startsAt,
    reason: data.reason ?? "Rendez-vous",
    report: data.outcome,
  });

  const updated = await ctx.db.appointment.update({
    where: { id: appointmentId },
    data: { status: "done", outcome: data.outcome, interventionId: intervention.id },
  });

  await recordAudit({
    action: "appointment.completed",
    cabinetId: ctx.cabinet.id,
    userId: ctx.user.id,
    resourceType: "Appointment",
    resourceId: appointmentId,
    metadata: { clientId: existing.clientId, interventionId: intervention.id },
    ip: ctx.ip,
    userAgent: ctx.userAgent,
  });

  return updated;
}

/** Annulation ou absence : le rendez-vous reste au calendrier, barré. */
export async function setAppointmentStatus(
  ctx: AuthContext,
  appointmentId: string,
  status: "cancelled" | "no_show" | "scheduled",
) {
  const existing = await find(ctx, appointmentId);
  if (existing.status === "done") {
    throw new ValidationError(
      "Ce rendez-vous est validé : sa ligne figure déjà dans la liste d'activité.",
    );
  }

  const updated = await ctx.db.appointment.update({
    where: { id: appointmentId },
    data: { status },
  });

  await recordAudit({
    action: `appointment.${status}`,
    cabinetId: ctx.cabinet.id,
    userId: ctx.user.id,
    resourceType: "Appointment",
    resourceId: appointmentId,
    ip: ctx.ip,
    userAgent: ctx.userAgent,
  });

  return updated;
}

export async function deleteAppointment(ctx: AuthContext, appointmentId: string) {
  const existing = await find(ctx, appointmentId);
  if (existing.status === "done") {
    throw new ValidationError(
      "Un rendez-vous validé ne se supprime pas : il a produit une ligne d'activité.",
    );
  }

  await ctx.db.appointment.delete({ where: { id: appointmentId } });
  await recordAudit({
    action: "appointment.deleted",
    cabinetId: ctx.cabinet.id,
    userId: ctx.user.id,
    resourceType: "Appointment",
    resourceId: appointmentId,
    metadata: { clientId: existing.clientId },
    ip: ctx.ip,
    userAgent: ctx.userAgent,
  });
  return existing;
}

async function find(ctx: AuthContext, appointmentId: string) {
  const found = await ctx.db.appointment.findFirst({ where: { id: appointmentId } });
  if (!found) throw new NotFoundError("Rendez-vous");
  return found;
}

/** Le collaborateur qui reçoit doit être membre actif du même cabinet. */
async function assertAssignee(ctx: AuthContext, assignedToId?: string) {
  if (!assignedToId) return;
  const member = await ctx.db.membership.findFirst({
    where: { userId: assignedToId, status: "active" },
    select: { id: true },
  });
  if (!member) throw new ForbiddenError("Collaborateur hors du cabinet");
}
