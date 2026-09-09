import { z } from "zod";
import { recordAudit } from "@/lib/audit";
import type { AuthContext } from "@/lib/authz/guard";

/**
 * Résultat du cabinet, mois par mois.
 *
 * C'est la comptabilité **du cabinet**, pas celle de ses clients. Elle est
 * saisie à la main : les honoraires facturés ne disent ni ce qui a été encaissé
 * ni ce qui a été dépensé, et un chiffre déduit à moitié serait pire qu'un
 * chiffre assumé. Le montant facturé du mois est tout de même rappelé à la
 * saisie, comme repère.
 *
 * Montants en centimes de dirham, comme partout ailleurs dans le produit.
 */
const resultSchema = z.object({
  /** « 2026-09 » : le mois, pas une date. */
  month: z
    .string()
    .trim()
    .regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Mois invalide."),
  /** Saisi en dirhams à l'écran, converti en centimes par l'action. */
  revenue: z.coerce.number().int().min(0).max(1_000_000_000_00),
  expenses: z.coerce.number().int().min(0).max(1_000_000_000_00),
  notes: z
    .string()
    .trim()
    .max(1000)
    .optional()
    .transform((v) => (v === "" ? undefined : v)),
});

export const MONTH_LABELS = [
  "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
  "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre",
] as const;

/** Clé de mois : minuit UTC du premier jour. */
export function monthKey(year: number, month: number): Date {
  return new Date(Date.UTC(year, month, 1));
}

export type MonthRow = {
  month: number;
  label: string;
  revenue: number;
  expenses: number;
  result: number;
  /** Résultat cumulé depuis janvier : ce que regarde un comptable. */
  cumulative: number;
  /** Honoraires facturés ce mois-là, comme repère de saisie. */
  invoiced: number;
  notes: string | null;
  filled: boolean;
};

/**
 * Les douze mois de l'exercice, remplis ou non.
 *
 * Les mois sans saisie sont renvoyés à zéro plutôt qu'omis : un graphique à
 * douze colonnes dont certaines manquent se lit mal, et un mois vide est une
 * information — il reste à saisir.
 */
export async function getYearResults(ctx: AuthContext, year: number) {
  const from = monthKey(year, 0);
  const to = monthKey(year + 1, 0);

  const [rows, invoices] = await Promise.all([
    ctx.db.monthlyResult.findMany({
      where: { month: { gte: from, lt: to } },
      orderBy: { month: "asc" },
    }),
    ctx.db.clientInvoice.findMany({
      where: { issuedAt: { gte: from, lt: to }, status: { not: "cancelled" } },
      select: { issuedAt: true, amount: true },
    }),
  ]);

  const byMonth = new Map(rows.map((row) => [row.month.getUTCMonth(), row]));

  const invoicedByMonth = new Map<number, number>();
  for (const invoice of invoices) {
    const index = invoice.issuedAt.getUTCMonth();
    invoicedByMonth.set(index, (invoicedByMonth.get(index) ?? 0) + invoice.amount);
  }

  let cumulative = 0;
  const months: MonthRow[] = MONTH_LABELS.map((label, month) => {
    const row = byMonth.get(month);
    const revenue = row?.revenue ?? 0;
    const expenses = row?.expenses ?? 0;
    const result = revenue - expenses;
    cumulative += result;
    return {
      month,
      label,
      revenue,
      expenses,
      result,
      cumulative,
      invoiced: invoicedByMonth.get(month) ?? 0,
      notes: row?.notes ?? null,
      filled: Boolean(row),
    };
  });

  const filled = months.filter((row) => row.filled);
  const totals = {
    revenue: filled.reduce((sum, row) => sum + row.revenue, 0),
    expenses: filled.reduce((sum, row) => sum + row.expenses, 0),
    result: filled.reduce((sum, row) => sum + row.result, 0),
    monthsFilled: filled.length,
  };

  return {
    year,
    months,
    totals,
    /** Moyenne sur les seuls mois saisis : diviser par douze en janvier n'aurait pas de sens. */
    average: filled.length > 0 ? Math.round(totals.result / filled.length) : 0,
    best: filled.length > 0 ? filled.reduce((a, b) => (b.result > a.result ? b : a)) : null,
    worst: filled.length > 0 ? filled.reduce((a, b) => (b.result < a.result ? b : a)) : null,
  };
}

/** Années déjà renseignées, pour le sélecteur. L'année en cours y figure toujours. */
export async function listResultYears(ctx: AuthContext, now = new Date()): Promise<number[]> {
  const rows = await ctx.db.monthlyResult.findMany({ select: { month: true } });
  const years = new Set(rows.map((row) => row.month.getUTCFullYear()));
  years.add(now.getUTCFullYear());
  return [...years].sort((a, b) => b - a);
}

/** Saisie ou correction d'un mois. Un mois se corrige, il ne se dédouble pas. */
export async function saveMonthlyResult(ctx: AuthContext, input: unknown) {
  const data = resultSchema.parse(input);
  const [year, month] = data.month.split("-").map(Number);
  const key = monthKey(year ?? 0, (month ?? 1) - 1);

  const saved = await ctx.db.monthlyResult.upsert({
    where: { cabinetId_month: { cabinetId: ctx.cabinet.id, month: key } },
    create: {
      cabinetId: ctx.cabinet.id,
      month: key,
      revenue: data.revenue,
      expenses: data.expenses,
      notes: data.notes ?? null,
      recordedById: ctx.user.id,
    },
    update: {
      revenue: data.revenue,
      expenses: data.expenses,
      notes: data.notes ?? null,
      recordedById: ctx.user.id,
    },
  });

  await recordAudit({
    action: "result.recorded",
    cabinetId: ctx.cabinet.id,
    userId: ctx.user.id,
    resourceType: "MonthlyResult",
    resourceId: saved.id,
    metadata: { month: data.month },
    ip: ctx.ip,
    userAgent: ctx.userAgent,
  });

  return saved;
}

export async function deleteMonthlyResult(ctx: AuthContext, resultId: string) {
  const existing = await ctx.db.monthlyResult.findFirst({ where: { id: resultId } });
  if (!existing) return null;

  await ctx.db.monthlyResult.delete({ where: { id: resultId } });
  await recordAudit({
    action: "result.deleted",
    cabinetId: ctx.cabinet.id,
    userId: ctx.user.id,
    resourceType: "MonthlyResult",
    resourceId: resultId,
    ip: ctx.ip,
    userAgent: ctx.userAgent,
  });
  return existing;
}
