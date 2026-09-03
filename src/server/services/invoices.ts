import { recordAudit } from "@/lib/audit";
import type { AuthContext } from "@/lib/authz/guard";
import { requireClient } from "@/lib/authz/guard";
import { NotFoundError, ValidationError } from "@/lib/errors";
import { invoiceSchema, paymentSchema } from "@/lib/validation/schemas";

/**
 * Facturation des honoraires du cabinet à ses clients.
 * À ne pas confondre avec la comptabilité des clients : il s'agit du suivi de ce que le
 * cabinet facture et encaisse. Les montants sont en centimes de dirham (entiers).
 */

export async function listInvoices(
  ctx: AuthContext,
  filters: { clientId?: string; status?: string } = {},
) {
  const where: Record<string, unknown> = {};
  if (filters.clientId) where.clientId = filters.clientId;
  if (filters.status === "unpaid") where.status = { in: ["pending", "partial", "overdue"] };
  else if (filters.status && filters.status !== "all") where.status = filters.status;

  return ctx.db.clientInvoice.findMany({
    where,
    orderBy: { dueDate: "asc" },
    include: { client: { select: { id: true, legalName: true } } },
    take: 300,
  });
}

export async function invoiceSummary(ctx: AuthContext) {
  const now = new Date();
  const [pending, paid, overdue, monthly] = await Promise.all([
    ctx.db.clientInvoice.aggregate({
      where: { status: { in: ["pending", "partial"] } },
      _sum: { amount: true, paidAmount: true },
      _count: { _all: true },
    }),
    ctx.db.clientInvoice.aggregate({
      where: { status: "paid" },
      _sum: { amount: true },
      _count: { _all: true },
    }),
    ctx.db.clientInvoice.aggregate({
      where: { status: { in: ["pending", "partial"] }, dueDate: { lt: now } },
      _sum: { amount: true, paidAmount: true },
      _count: { _all: true },
    }),
    ctx.db.clientInvoice.groupBy({
      by: ["status"],
      _count: { _all: true },
    }),
  ]);

  return {
    outstanding: (pending._sum.amount ?? 0) - (pending._sum.paidAmount ?? 0),
    outstandingCount: pending._count._all,
    overdue: (overdue._sum.amount ?? 0) - (overdue._sum.paidAmount ?? 0),
    overdueCount: overdue._count._all,
    paidTotal: paid._sum.amount ?? 0,
    paidCount: paid._count._all,
    byStatus: monthly,
  };
}

/**
 * Prochaine référence libre, au format `AAAA-NNNN`.
 *
 * La référence est obligatoire et unique par cabinet : la proposer évite de la
 * chercher à chaque facture, tout en la laissant modifiable — un cabinet qui a
 * déjà sa propre numérotation la garde.
 */
export async function nextInvoiceReference(ctx: AuthContext, now = new Date()): Promise<string> {
  const year = now.getUTCFullYear();
  const last = await ctx.db.clientInvoice.findFirst({
    where: { reference: { startsWith: `${year}-` } },
    orderBy: { reference: "desc" },
    select: { reference: true },
  });
  const previous = last ? Number.parseInt(last.reference.slice(5), 10) : 0;
  const next = Number.isNaN(previous) ? 1 : previous + 1;
  return `${year}-${String(next).padStart(4, "0")}`;
}

export async function createInvoice(ctx: AuthContext, input: unknown) {
  const data = invoiceSchema.parse(input);
  await requireClient(ctx, data.clientId);

  const duplicate = await ctx.db.clientInvoice.findFirst({ where: { reference: data.reference } });
  if (duplicate) throw new ValidationError("Cette référence de facture existe déjà.");

  const invoice = await ctx.db.clientInvoice.create({
    data: {
      cabinetId: ctx.cabinet.id,
      clientId: data.clientId,
      reference: data.reference,
      label: data.label ?? null,
      amount: data.amount,
      vatRate: data.vatRate,
      issuedAt: data.issuedAt,
      dueDate: data.dueDate,
      notes: data.notes ?? null,
    },
  });

  await recordAudit({
    action: "invoice.created",
    cabinetId: ctx.cabinet.id,
    userId: ctx.user.id,
    resourceType: "ClientInvoice",
    resourceId: invoice.id,
    metadata: { reference: invoice.reference, amount: invoice.amount },
    ip: ctx.ip,
  });

  return invoice;
}

export async function recordPayment(ctx: AuthContext, input: unknown) {
  const data = paymentSchema.parse(input);
  const invoice = await ctx.db.clientInvoice.findFirst({ where: { id: data.invoiceId } });
  if (!invoice) throw new NotFoundError("Facture");

  const paidAmount = invoice.paidAmount + data.amount;
  if (paidAmount > invoice.amount) {
    throw new ValidationError("Le total encaissé dépasse le montant de la facture.");
  }

  const updated = await ctx.db.clientInvoice.update({
    where: { id: data.invoiceId },
    data: {
      paidAmount,
      status: paidAmount >= invoice.amount ? "paid" : "partial",
      paidAt: paidAmount >= invoice.amount ? data.paidAt : null,
      paymentMode: data.paymentMode,
    },
  });

  await Promise.all([
    recordAudit({
      action: "invoice.payment_recorded",
      cabinetId: ctx.cabinet.id,
      userId: ctx.user.id,
      resourceType: "ClientInvoice",
      resourceId: invoice.id,
      metadata: { amount: data.amount, mode: data.paymentMode },
      ip: ctx.ip,
    }),
    ctx.db.activity.create({
      data: {
        cabinetId: ctx.cabinet.id,
        clientId: invoice.clientId,
        actorId: ctx.user.id,
        type: "invoice.paid",
        summary: `Encaissement enregistré sur la facture ${invoice.reference}`,
      },
    }),
  ]);

  return updated;
}

/** Passe en « overdue » les factures échues. Appelé par la tâche de fond quotidienne. */
export async function markOverdueInvoices(ctx: AuthContext) {
  const { count } = await ctx.db.clientInvoice.updateMany({
    where: { status: { in: ["pending", "partial"] }, dueDate: { lt: new Date() } },
    data: { status: "overdue" },
  });
  return count;
}
