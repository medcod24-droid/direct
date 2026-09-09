import { z } from "zod";
import { recordAudit } from "@/lib/audit";
import type { AuthContext } from "@/lib/authz/guard";
import { requireClient } from "@/lib/authz/guard";
import { NotFoundError } from "@/lib/errors";

/**
 * Registre des services rendus au client par le cabinet.
 *
 * À ne pas confondre avec `Activity`, qui est la trace automatique de ce que la
 * plateforme enregistre. Ici c'est le comptable qui écrit : quel service, quand,
 * pourquoi, et ce qu'il en est résulté. C'est ce registre que l'on relit pour
 * savoir ce que le cabinet a fait pour un dossier — et qui s'imprime avec la
 * fiche, pour le classeur papier.
 */
const interventionSchema = z.object({
  clientId: z.string().min(1),
  service: z.string().trim().min(2, "Nom du service requis.").max(160),
  performedAt: z.coerce.date(),
  reason: z
    .string()
    .trim()
    .max(500)
    .optional()
    .transform((v) => (v === "" ? undefined : v)),
  report: z
    .string()
    .trim()
    .max(4000)
    .optional()
    .transform((v) => (v === "" ? undefined : v)),
});

export async function listInterventions(ctx: AuthContext, clientId: string) {
  await requireClient(ctx, clientId);
  return ctx.db.intervention.findMany({
    where: { clientId },
    // Du plus récent au plus ancien : on relit un dossier en partant de ce qui
    // vient d'être fait, pas de sa création.
    orderBy: [{ performedAt: "desc" }, { createdAt: "desc" }],
    include: { createdBy: { select: { id: true, name: true } } },
  });
}

export async function createIntervention(ctx: AuthContext, input: unknown) {
  const data = interventionSchema.parse(input);
  await requireClient(ctx, data.clientId);

  const created = await ctx.db.intervention.create({
    data: {
      cabinetId: ctx.cabinet.id,
      clientId: data.clientId,
      service: data.service,
      performedAt: data.performedAt,
      reason: data.reason ?? null,
      report: data.report ?? null,
      createdById: ctx.user.id,
    },
  });

  await Promise.all([
    recordAudit({
      action: "intervention.created",
      cabinetId: ctx.cabinet.id,
      userId: ctx.user.id,
      resourceType: "Intervention",
      resourceId: created.id,
      metadata: { clientId: data.clientId, service: data.service },
      ip: ctx.ip,
      userAgent: ctx.userAgent,
    }),
    ctx.db.activity.create({
      data: {
        cabinetId: ctx.cabinet.id,
        clientId: data.clientId,
        actorId: ctx.user.id,
        type: "intervention.created",
        summary: `Service enregistré : ${data.service}`,
      },
    }),
  ]);

  return created;
}

export async function updateIntervention(ctx: AuthContext, interventionId: string, input: unknown) {
  const existing = await ctx.db.intervention.findFirst({ where: { id: interventionId } });
  if (!existing) throw new NotFoundError("Service");

  // Le dossier n'est pas modifiable : déplacer une ligne d'un dossier à l'autre
  // réécrirait l'historique de deux clients à la fois.
  const data = interventionSchema.parse({ ...(input as object), clientId: existing.clientId });

  const updated = await ctx.db.intervention.update({
    where: { id: interventionId },
    data: {
      service: data.service,
      performedAt: data.performedAt,
      reason: data.reason ?? null,
      report: data.report ?? null,
    },
  });

  await recordAudit({
    action: "intervention.updated",
    cabinetId: ctx.cabinet.id,
    userId: ctx.user.id,
    resourceType: "Intervention",
    resourceId: interventionId,
    metadata: { clientId: existing.clientId },
    ip: ctx.ip,
    userAgent: ctx.userAgent,
  });

  return updated;
}

export async function deleteIntervention(ctx: AuthContext, interventionId: string) {
  const existing = await ctx.db.intervention.findFirst({ where: { id: interventionId } });
  if (!existing) throw new NotFoundError("Service");

  await ctx.db.intervention.delete({ where: { id: interventionId } });

  await recordAudit({
    action: "intervention.deleted",
    cabinetId: ctx.cabinet.id,
    userId: ctx.user.id,
    resourceType: "Intervention",
    resourceId: interventionId,
    metadata: { clientId: existing.clientId, service: existing.service },
    ip: ctx.ip,
    userAgent: ctx.userAgent,
  });

  return existing;
}
