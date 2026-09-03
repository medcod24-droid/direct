import { recordAudit } from "@/lib/audit";
import type { AuthContext } from "@/lib/authz/guard";
import { requireClient } from "@/lib/authz/guard";
import {
  estimatePenalty,
  generateDeadlines,
  type ClientInput,
  type DateFormula,
  type PenaltyFormula,
  type RuleInput,
} from "@/lib/deadlines/engine";
import { NotFoundError, ValidationError } from "@/lib/errors";
import { deadlineManagedBySchema, deadlineUpdateSchema } from "@/lib/validation/schemas";

/**
 * Génération et suivi des échéances.
 * Les règles viennent de la base (système + surcharges du cabinet) ; le calcul est fait
 * par le moteur pur, testé séparément.
 */

type StoredRule = {
  id: string;
  code: string;
  label: string;
  frequency: string;
  dateFormula: string;
  appliesTo: string;
  penaltyFormula: string | null;
  cabinetId: string | null;
  verificationStatus: string;
};

function parseRules(rows: StoredRule[]): RuleInput[] {
  // Une règle du cabinet portant le même code qu'une règle système la remplace.
  const byCode = new Map<string, StoredRule>();
  for (const row of rows) {
    const existing = byCode.get(row.code);
    if (!existing || (existing.cabinetId === null && row.cabinetId !== null)) {
      byCode.set(row.code, row);
    }
  }
  return [...byCode.values()].map((row) => ({
    id: row.id,
    code: row.code,
    label: row.label,
    frequency: row.frequency as RuleInput["frequency"],
    dateFormula: JSON.parse(row.dateFormula) as DateFormula,
    appliesTo: JSON.parse(row.appliesTo) as RuleInput["appliesTo"],
    penaltyFormula: row.penaltyFormula ? (JSON.parse(row.penaltyFormula) as PenaltyFormula) : null,
  }));
}

export async function listRules(ctx: AuthContext) {
  const rows = (await ctx.db.deadlineRule.findMany({
    where: { isActive: true },
    orderBy: { code: "asc" },
  })) as unknown as StoredRule[];
  return rows;
}

/**
 * Génère les échéances d'une année pour un dossier (ou tous les dossiers actifs).
 * Idempotent : une échéance déjà présente pour la même période n'est pas dupliquée.
 */
export async function generateForYear(
  ctx: AuthContext,
  input: { year: number; clientId?: string; holidays?: string[] },
) {
  const rules = parseRules((await listRules(ctx)) as StoredRule[]);
  const clients = input.clientId
    ? [await requireClient(ctx, input.clientId)]
    : await ctx.db.client.findMany({ where: { status: { in: ["active", "onboarding"] } } });

  const holidays = new Set(input.holidays ?? []);
  let created = 0;

  for (const client of clients) {
    const generated = generateDeadlines({
      client: {
        id: client.id,
        subtype: client.subtype,
        taxRegime: client.taxRegime,
        vatRegime: client.vatRegime,
        isEmployer: client.isEmployer,
        referenceRevenue: client.referenceRevenue,
        fiscalYearEndMonth: client.fiscalYearEndMonth,
        fiscalYearEndDay: client.fiscalYearEndDay,
        takeoverDate: client.takeoverDate,
        activityState: client.activityState,
      } satisfies ClientInput,
      rules,
      year: input.year,
      holidays,
    });

    if (generated.length === 0) continue;

    const existing = await ctx.db.deadline.findMany({
      where: { clientId: client.id, periodLabel: { in: generated.map((g) => g.periodLabel) } },
      select: { periodLabel: true },
    });
    const known = new Set(existing.map((e) => e.periodLabel));
    const fresh = generated.filter((g) => !known.has(g.periodLabel));

    if (fresh.length) {
      await ctx.db.deadline.createMany({
        data: fresh.map((g) => ({
          cabinetId: ctx.cabinet.id,
          clientId: client.id,
          ruleId: g.ruleId ?? null,
          label: g.label,
          periodLabel: g.periodLabel,
          dueDate: g.dueDate,
          managedBy: g.managedBy,
          status: "upcoming",
        })),
      });
      created += fresh.length;
    }
  }

  await recordAudit({
    action: "deadline.generated",
    cabinetId: ctx.cabinet.id,
    userId: ctx.user.id,
    metadata: { year: input.year, clients: clients.length, created },
    ip: ctx.ip,
  });

  return { clients: clients.length, created };
}

export async function listDeadlines(
  ctx: AuthContext,
  filters: {
    clientId?: string;
    status?: string;
    q?: string;
    /** Référence temporelle du calcul de retard ; injectable pour les tests. */
    now?: Date;
    from?: Date;
    to?: Date;
    assigneeId?: string;
  } = {},
) {
  const where: Record<string, unknown> = {};
  if (filters.clientId) where.clientId = filters.clientId;
  if (filters.assigneeId) where.assigneeId = filters.assigneeId;
  if (filters.status === "open") {
    where.status = { in: ["upcoming", "in_progress", "declared"] };
  } else if (filters.status === "overdue") {
    // Le retard n'est pas un statut stocké, il se déduit de la date : filtrer sur
    // `status = "overdue"` ne renvoyait jamais rien, et l'onglet « En retard »
    // restait vide alors même que le tableau de bord y renvoyait.
    where.status = { in: ["upcoming", "in_progress", "declared"] };
    where.dueDate = { lt: filters.now ?? new Date() };
  } else if (filters.status && filters.status !== "all") {
    where.status = filters.status;
  }
  const q = filters.q?.trim();
  if (q) {
    // Recherche sur le dossier et sur l'intitulé de l'obligation. Comme ailleurs dans le
    // produit, `contains` reste sensible à la casse sur SQLite (voir README) ; en
    // PostgreSQL, un index trigram sur `Client.legalName` couvre ce filtre.
    where.OR = [
      { client: { legalName: { contains: q } } },
      { client: { tradeName: { contains: q } } },
      { client: { ice: { contains: q } } },
      { label: { contains: q } },
      { periodLabel: { contains: q } },
    ];
  }
  if (filters.from || filters.to) {
    where.dueDate = {
      ...(typeof where.dueDate === "object" ? where.dueDate : {}),
      ...(filters.from ? { gte: filters.from } : {}),
      ...(filters.to ? { lte: filters.to } : {}),
    };
  }

  return ctx.db.deadline.findMany({
    where,
    orderBy: { dueDate: "asc" },
    include: {
      client: { select: { id: true, legalName: true } },
      proof: { select: { id: true, filename: true } },
    },
    take: 500,
  });
}

/** Passage d'une échéance à « déclarée » puis « payée », preuve à l'appui. */
export async function updateDeadlineStatus(ctx: AuthContext, input: unknown) {
  const data = deadlineUpdateSchema.parse(input);
  const deadline = await ctx.db.deadline.findFirst({ where: { id: data.deadlineId } });
  if (!deadline) throw new NotFoundError("Échéance");

  if (data.proofDocumentId) {
    const proof = await ctx.db.document.findFirst({ where: { id: data.proofDocumentId } });
    if (!proof) throw new NotFoundError("Document de preuve");
    if (proof.clientId !== deadline.clientId) {
      throw new ValidationError("La preuve doit appartenir au même dossier client.");
    }
  }

  const now = new Date();
  const patch: Record<string, unknown> = { notes: data.notes ?? deadline.notes };

  switch (data.action) {
    case "declare":
      patch.status = "declared";
      patch.declaredAt = now;
      if (data.proofDocumentId) patch.proofDocumentId = data.proofDocumentId;
      break;
    case "pay":
      // Une échéance ne passe au vert que si le dépôt est prouvé : c'est la pièce que le
      // cabinet produira en cas de contrôle. Une preuve déjà jointe à la déclaration suffit.
      if (!data.proofDocumentId && !deadline.proofDocumentId) {
        throw new ValidationError(
          "Joignez la preuve de dépôt (accusé du portail) avant de marquer l'échéance payée.",
        );
      }
      patch.status = "paid";
      patch.paidAt = now;
      if (!deadline.declaredAt) patch.declaredAt = now;
      if (data.proofDocumentId) patch.proofDocumentId = data.proofDocumentId;
      break;
    case "reopen":
      patch.status = "upcoming";
      patch.declaredAt = null;
      patch.paidAt = null;
      break;
    case "not_applicable":
      if (!data.notes) throw new ValidationError("Justifiez pourquoi cette échéance ne s'applique pas.");
      patch.status = "not_applicable";
      break;
  }

  const updated = await ctx.db.deadline.update({ where: { id: data.deadlineId }, data: patch });

  await Promise.all([
    recordAudit({
      action: `deadline.${data.action}`,
      cabinetId: ctx.cabinet.id,
      userId: ctx.user.id,
      resourceType: "Deadline",
      resourceId: data.deadlineId,
      metadata: { periodLabel: deadline.periodLabel },
      ip: ctx.ip,
    }),
    ctx.db.activity.create({
      data: {
        cabinetId: ctx.cabinet.id,
        clientId: deadline.clientId,
        actorId: ctx.user.id,
        type: `deadline.${data.action}`,
        summary: `${deadline.label} — ${data.action === "pay" ? "payée" : data.action === "declare" ? "déclarée" : data.action}`,
        visibleToClient: data.action === "declare" || data.action === "pay",
      },
    }),
  ]);

  return updated;
}

export async function setManagedBy(ctx: AuthContext, input: unknown) {
  const data = deadlineManagedBySchema.parse(input);
  const deadline = await ctx.db.deadline.findFirst({ where: { id: data.deadlineId } });
  if (!deadline) throw new NotFoundError("Échéance");

  const updated = await ctx.db.deadline.update({
    where: { id: data.deadlineId },
    data: { managedBy: data.managedBy },
  });
  await recordAudit({
    action: "deadline.managed_by",
    cabinetId: ctx.cabinet.id,
    userId: ctx.user.id,
    resourceType: "Deadline",
    resourceId: data.deadlineId,
    metadata: { managedBy: data.managedBy },
    ip: ctx.ip,
  });
  return updated;
}

/**
 * « Mode panne » : journalise une tentative de dépôt empêchée par l'indisponibilité d'un
 * portail public. Sert de pièce à l'appui d'une demande de remise de majorations.
 */
export async function logOutageAttempt(
  ctx: AuthContext,
  deadlineId: string,
  input: { portal: string; message: string },
) {
  const deadline = await ctx.db.deadline.findFirst({ where: { id: deadlineId } });
  if (!deadline) throw new NotFoundError("Échéance");

  const log = deadline.outageLog ? (JSON.parse(deadline.outageLog) as unknown[]) : [];
  log.push({
    at: new Date().toISOString(),
    portal: input.portal,
    message: input.message.slice(0, 500),
    userId: ctx.user.id,
  });

  const updated = await ctx.db.deadline.update({
    where: { id: deadlineId },
    data: { outageLog: JSON.stringify(log) },
  });

  await recordAudit({
    action: "deadline.outage_logged",
    cabinetId: ctx.cabinet.id,
    userId: ctx.user.id,
    resourceType: "Deadline",
    resourceId: deadlineId,
    metadata: { portal: input.portal },
    ip: ctx.ip,
  });

  return updated;
}

/** Estimation du coût d'un retard, à afficher sur la fiche client. */
export async function estimateDeadlinePenalty(
  ctx: AuthContext,
  deadlineId: string,
  amount: number,
) {
  const deadline = await ctx.db.deadline.findFirst({
    where: { id: deadlineId },
    include: { rule: { select: { penaltyFormula: true } } },
  });
  if (!deadline) throw new NotFoundError("Échéance");
  if (!deadline.rule?.penaltyFormula) return 0;

  const daysLate = Math.floor((Date.now() - deadline.dueDate.getTime()) / 86400000);
  return estimatePenalty(JSON.parse(deadline.rule.penaltyFormula) as PenaltyFormula, {
    amount,
    daysLate,
  });
}
