import type { AuthContext } from "@/lib/authz/guard";
import { getEntitlements, usageWarnings } from "@/lib/billing/entitlements";

const DAY = 86400000;

/**
 * Tableau de bord du cabinet.
 * Tout est calculé par agrégats côté base : aucune boucle sur les dossiers, et le nombre
 * de requêtes ne dépend pas du nombre de clients.
 */
export async function getCabinetDashboard(ctx: AuthContext) {
  const now = new Date();
  const todayEnd = new Date(now);
  todayEnd.setUTCHours(23, 59, 59, 999);
  const weekEnd = new Date(now.getTime() + 7 * DAY);
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));

  const [
    clientsTotal,
    clientsActive,
    clientsNewThisMonth,
    deadlinesOverdue,
    deadlinesToday,
    deadlinesWeek,
    requestsPending,
    requestsToReview,
    tasksOpen,
    tasksOverdue,
    myTasks,
    documentsThisMonth,
    documentsExpiring,
    invoicesOutstanding,
    invoicesOverdue,
    recentActivity,
    entitlements,
  ] = await Promise.all([
    ctx.db.client.count(),
    ctx.db.client.count({ where: { status: "active" } }),
    ctx.db.client.count({ where: { createdAt: { gte: monthStart } } }),
    ctx.db.deadline.count({
      where: {
        managedBy: "cabinet",
        status: { in: ["upcoming", "in_progress", "declared"] },
        dueDate: { lt: now },
      },
    }),
    ctx.db.deadline.count({
      where: {
        managedBy: "cabinet",
        status: { in: ["upcoming", "in_progress"] },
        dueDate: { gte: now, lte: todayEnd },
      },
    }),
    ctx.db.deadline.count({
      where: {
        managedBy: "cabinet",
        status: { in: ["upcoming", "in_progress"] },
        dueDate: { gt: todayEnd, lte: weekEnd },
      },
    }),
    ctx.db.documentRequest.count({ where: { status: "pending" } }),
    ctx.db.documentRequest.count({ where: { status: "submitted" } }),
    ctx.db.task.count({ where: { status: { notIn: ["done", "cancelled"] } } }),
    ctx.db.task.count({
      where: { status: { notIn: ["done", "cancelled"] }, dueDate: { lt: now } },
    }),
    ctx.db.task.count({
      where: { assigneeId: ctx.user.id, status: { notIn: ["done", "cancelled"] } },
    }),
    ctx.db.document.count({ where: { createdAt: { gte: monthStart } } }),
    ctx.db.document.count({
      where: { expiresAt: { gte: now, lte: new Date(now.getTime() + 30 * DAY) } },
    }),
    ctx.db.clientInvoice.aggregate({
      where: { status: { in: ["pending", "partial", "overdue"] } },
      _sum: { amount: true, paidAmount: true },
      _count: { _all: true },
    }),
    ctx.db.clientInvoice.count({
      where: { status: { in: ["pending", "partial", "overdue"] }, dueDate: { lt: now } },
    }),
    ctx.db.activity.findMany({
      orderBy: { createdAt: "desc" },
      take: 12,
      include: { client: { select: { id: true, legalName: true } } },
    }),
    getEntitlements(ctx.cabinet.id).catch(() => null),
  ]);

  return {
    clients: { total: clientsTotal, active: clientsActive, newThisMonth: clientsNewThisMonth },
    deadlines: { overdue: deadlinesOverdue, today: deadlinesToday, week: deadlinesWeek },
    requests: { pending: requestsPending, toReview: requestsToReview },
    tasks: { open: tasksOpen, overdue: tasksOverdue, mine: myTasks },
    documents: { thisMonth: documentsThisMonth, expiringSoon: documentsExpiring },
    invoices: {
      outstanding: (invoicesOutstanding._sum.amount ?? 0) - (invoicesOutstanding._sum.paidAmount ?? 0),
      count: invoicesOutstanding._count._all,
      overdueCount: invoicesOverdue,
    },
    activity: recentActivity,
    entitlements,
    warnings: entitlements ? usageWarnings(entitlements) : [],
  };
}

/** Clients demandant une attention : le tri se fait sur des faits, pas sur un score opaque. */
export async function getClientsNeedingAttention(ctx: AuthContext, limit = 8) {
  const now = new Date();
  const rows = await ctx.db.deadline.groupBy({
    by: ["clientId"],
    where: {
      managedBy: "cabinet",
      status: { in: ["upcoming", "in_progress", "declared"] },
      dueDate: { lt: now },
    },
    _count: { _all: true },
    orderBy: { _count: { clientId: "desc" } },
    take: limit,
  });

  if (rows.length === 0) return [];

  const clients = await ctx.db.client.findMany({
    where: { id: { in: rows.map((r) => r.clientId) } },
    select: { id: true, legalName: true, subtype: true },
  });
  const byId = new Map(clients.map((c) => [c.id, c]));

  return rows
    .map((row) => ({ client: byId.get(row.clientId), overdue: row._count._all }))
    .filter((row): row is { client: NonNullable<ReturnType<typeof byId.get>>; overdue: number } =>
      Boolean(row.client),
    );
}

/** Statistiques mensuelles simples pour les graphiques du tableau de bord. */
export async function getMonthlyStats(ctx: AuthContext, months = 6) {
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (months - 1), 1));

  const [clients, documents, invoices] = await Promise.all([
    ctx.db.client.findMany({ where: { createdAt: { gte: start } }, select: { createdAt: true } }),
    ctx.db.document.findMany({ where: { createdAt: { gte: start } }, select: { createdAt: true } }),
    ctx.db.clientInvoice.findMany({
      where: { issuedAt: { gte: start } },
      select: { issuedAt: true, amount: true, paidAmount: true },
    }),
  ]);

  const buckets = new Map<string, { clients: number; documents: number; billed: number; collected: number }>();
  for (let index = 0; index < months; index += 1) {
    const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (months - 1 - index), 1));
    buckets.set(date.toISOString().slice(0, 7), { clients: 0, documents: 0, billed: 0, collected: 0 });
  }
  const key = (date: Date) => date.toISOString().slice(0, 7);

  for (const row of clients) {
    const bucket = buckets.get(key(row.createdAt));
    if (bucket) bucket.clients += 1;
  }
  for (const row of documents) {
    const bucket = buckets.get(key(row.createdAt));
    if (bucket) bucket.documents += 1;
  }
  for (const row of invoices) {
    const bucket = buckets.get(key(row.issuedAt));
    if (bucket) {
      bucket.billed += row.amount;
      bucket.collected += row.paidAmount;
    }
  }

  return [...buckets.entries()].map(([month, values]) => ({ month, ...values }));
}
