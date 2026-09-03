import { z } from "zod";
import { recordAudit } from "@/lib/audit";
import type { AuthContext } from "@/lib/authz/guard";
import { requireClient } from "@/lib/authz/guard";
import { assertWithinLimit } from "@/lib/billing/entitlements";
import { computeHealth, type HealthResult } from "@/lib/domain/health";
import { ForbiddenError } from "@/lib/errors";
import { rateClient, volumePercentile, type Rating } from "@/lib/clients/rating";
import { clientSchema, searchSchema } from "@/lib/validation/schemas";

const DAY = 86400000;

export type ClientListItem = {
  id: string;
  legalName: string;
  subtype: string;
  city: string | null;
  status: string;
  ice: string | null;
  health: HealthResult;
  openDeadlines: number;
};

/** Recherche paginée. Le filtre du cabinet est appliqué par le client Prisma étendu. */
export async function listClients(ctx: AuthContext, input: unknown) {
  const { q, status, page, perPage } = searchSchema.parse(input ?? {});

  const where: Record<string, unknown> = {};
  if (status && status !== "all") where.status = status;
  if (q) {
    // SQLite ne connaît pas `mode: "insensitive"` : la recherche reste sensible à la casse
    // sur cette base. En production (PostgreSQL), activer un index trigram ou citext.
    where.OR = [
      { legalName: { contains: q } },
      { tradeName: { contains: q } },
      { ice: { contains: q } },
      { if: { contains: q } },
      { rc: { contains: q } },
      { email: { contains: q } },
      { phone: { contains: q } },
    ];
  }

  const [total, rows] = await Promise.all([
    ctx.db.client.count({ where }),
    ctx.db.client.findMany({
      where,
      orderBy: { legalName: "asc" },
      skip: (page - 1) * perPage,
      take: perPage,
      select: {
        id: true,
        legalName: true,
        subtype: true,
        city: true,
        status: true,
        ice: true,
      },
    }),
  ]);

  const health = await healthForClients(ctx, rows.map((r) => r.id));

  return {
    page,
    perPage,
    total,
    pageCount: Math.max(1, Math.ceil(total / perPage)),
    items: rows.map((row) => ({
      ...row,
      health: health.get(row.id)?.health ?? { status: "green" as const, reasons: [] },
      openDeadlines: health.get(row.id)?.openDeadlines ?? 0,
    })),
  };
}

/**
 * Santé de plusieurs dossiers en quelques requêtes agrégées (pas de N+1 :
 * on ne boucle jamais sur les clients pour interroger la base).
 */
export async function healthForClients(ctx: AuthContext, clientIds: string[]) {
  const result = new Map<string, { health: HealthResult; openDeadlines: number }>();
  if (clientIds.length === 0) return result;

  const now = new Date();
  const soon = new Date(now.getTime() + 7 * DAY);

  const [overdue, dueSoon, lateRequests, expiredDocs, overdueInvoices] = await Promise.all([
    ctx.db.deadline.groupBy({
      by: ["clientId"],
      where: {
        clientId: { in: clientIds },
        managedBy: "cabinet",
        status: { in: ["upcoming", "in_progress", "declared"] },
        dueDate: { lt: now },
      },
      _count: { _all: true },
    }),
    ctx.db.deadline.groupBy({
      by: ["clientId"],
      where: {
        clientId: { in: clientIds },
        managedBy: "cabinet",
        status: { in: ["upcoming", "in_progress"] },
        dueDate: { gte: now, lte: soon },
      },
      _count: { _all: true },
    }),
    ctx.db.documentRequest.groupBy({
      by: ["clientId"],
      where: { clientId: { in: clientIds }, status: "pending", dueDate: { lt: now } },
      _count: { _all: true },
    }),
    ctx.db.document.groupBy({
      by: ["clientId"],
      where: { clientId: { in: clientIds }, expiresAt: { lt: now }, status: { not: "archived" } },
      _count: { _all: true },
    }),
    ctx.db.clientInvoice.groupBy({
      by: ["clientId"],
      where: { clientId: { in: clientIds }, status: { in: ["pending", "partial"] }, dueDate: { lt: now } },
      _count: { _all: true },
    }),
  ]);

  const toMap = (rows: Array<{ clientId: string | null; _count: { _all: number } }>) =>
    new Map(rows.filter((r) => r.clientId).map((r) => [r.clientId!, r._count._all]));

  const overdueMap = toMap(overdue);
  const soonMap = toMap(dueSoon);
  const requestMap = toMap(lateRequests);
  const docMap = toMap(expiredDocs);
  const invoiceMap = toMap(overdueInvoices);

  for (const id of clientIds) {
    const health = computeHealth({
      overdueDeadlines: overdueMap.get(id) ?? 0,
      deadlinesDueSoon: soonMap.get(id) ?? 0,
      pendingRequestsOverdue: requestMap.get(id) ?? 0,
      missingRequiredDocuments: 0,
      expiredDocuments: docMap.get(id) ?? 0,
      overdueInvoices: invoiceMap.get(id) ?? 0,
    });
    result.set(id, { health, openDeadlines: (overdueMap.get(id) ?? 0) + (soonMap.get(id) ?? 0) });
  }
  return result;
}

export async function getClientOverview(ctx: AuthContext, clientId: string) {
  const client = await requireClient(ctx, clientId);
  const now = new Date();

  const [contacts, deadlines, requests, documents, tasks, invoices, activities, health] =
    await Promise.all([
      ctx.db.contact.findMany({ where: { clientId }, orderBy: { isPrimary: "desc" } }),
      ctx.db.deadline.findMany({
        where: { clientId, status: { notIn: ["paid", "not_applicable"] } },
        orderBy: { dueDate: "asc" },
        take: 12,
      }),
      ctx.db.documentRequest.findMany({
        where: { clientId, status: { in: ["pending", "submitted"] } },
        orderBy: { createdAt: "desc" },
        take: 12,
      }),
      ctx.db.document.findMany({
        where: { clientId },
        orderBy: { createdAt: "desc" },
        take: 8,
        include: { category: { select: { name: true } } },
      }),
      ctx.db.task.findMany({
        where: { clientId, status: { notIn: ["done", "cancelled"] } },
        orderBy: { dueDate: "asc" },
        take: 10,
      }),
      ctx.db.clientInvoice.findMany({
        where: { clientId, status: { in: ["pending", "partial", "overdue"] } },
        orderBy: { dueDate: "asc" },
      }),
      ctx.db.activity.findMany({
        where: { clientId },
        orderBy: { createdAt: "desc" },
        take: 20,
      }),
      healthForClients(ctx, [clientId]),
    ]);

  const outstanding = invoices.reduce((sum, invoice) => sum + invoice.amount - invoice.paidAmount, 0);

  return {
    client,
    contacts,
    deadlines,
    requests,
    documents,
    tasks,
    invoices,
    activities,
    outstanding,
    overdueInvoices: invoices.filter((i) => i.dueDate < now).length,
    health: health.get(clientId)?.health ?? computeHealth({
      overdueDeadlines: 0,
      deadlinesDueSoon: 0,
      pendingRequestsOverdue: 0,
      missingRequiredDocuments: 0,
      expiredDocuments: 0,
      overdueInvoices: 0,
    }),
  };
}

/**
 * Note des dossiers demandés, en trois requêtes quel que soit leur nombre.
 *
 * Le volume est comparé à celui de **tous** les dossiers du cabinet, pas seulement
 * à ceux de la page en cours : sinon la note d'un dossier changerait selon la page
 * où on le regarde. Le calcul lui-même est dans `lib/clients/rating.ts`.
 */
export async function ratingsForClients(
  ctx: AuthContext,
  clientIds: string[],
  now = new Date(),
): Promise<Map<string, Rating>> {
  const result = new Map<string, Rating>();
  if (clientIds.length === 0) return result;

  const since = new Date(now.getTime() - 365 * DAY);

  const [cabinetVolumes, invoices] = await Promise.all([
    // Base de comparaison : chiffre d'affaires par dossier sur douze mois glissants.
    ctx.db.clientInvoice.groupBy({
      by: ["clientId"],
      where: { issuedAt: { gte: since }, status: { not: "cancelled" } },
      _sum: { amount: true },
    }),
    ctx.db.clientInvoice.findMany({
      where: { clientId: { in: clientIds } },
      select: {
        clientId: true,
        amount: true,
        paidAmount: true,
        dueDate: true,
        paidAt: true,
        status: true,
        issuedAt: true,
      },
    }),
  ]);

  const allAmounts = cabinetVolumes.map((row) => row._sum.amount ?? 0);
  const volumeByClient = new Map(cabinetVolumes.map((row) => [row.clientId, row._sum.amount ?? 0]));

  const byClient = new Map<string, typeof invoices>();
  for (const invoice of invoices) {
    const list = byClient.get(invoice.clientId);
    if (list) list.push(invoice);
    else byClient.set(invoice.clientId, [invoice]);
  }

  for (const clientId of clientIds) {
    result.set(
      clientId,
      rateClient({
        invoices: byClient.get(clientId) ?? [],
        volumePercentile: volumePercentile(volumeByClient.get(clientId) ?? 0, allAmounts),
        now,
      }),
    );
  }

  return result;
}

export async function createClient(ctx: AuthContext, input: unknown) {
  const data = clientSchema.parse(input);
  await assertWithinLimit(ctx.cabinet.id, "clients");

  // Le numéro de CIN n'est stocké que si le cabinet a l'autorisation CNDP correspondante.
  const managerCin = ctx.cabinet.cndpMode === "authorization" ? data.managerCin : undefined;
  if (data.managerCin && ctx.cabinet.cndpMode !== "authorization") {
    throw new ForbiddenError(
      "CIN refusée en mode déclaration",
      "Votre cabinet est en mode « déclaration » : le numéro de CIN ne peut pas être enregistré. Activez le mode « autorisation » dans les paramètres après votre autorisation CNDP.",
    );
  }

  const created = await ctx.db.client.create({
    data: { ...data, cabinetId: ctx.cabinet.id, managerCin, tags: "[]" },
  });

  await Promise.all([
    recordAudit({
      action: "client.created",
      cabinetId: ctx.cabinet.id,
      userId: ctx.user.id,
      resourceType: "Client",
      resourceId: created.id,
      metadata: { legalName: created.legalName, subtype: created.subtype },
      ip: ctx.ip,
      userAgent: ctx.userAgent,
    }),
    ctx.db.activity.create({
      data: {
        cabinetId: ctx.cabinet.id,
        clientId: created.id,
        actorId: ctx.user.id,
        type: "client.created",
        summary: `Dossier créé : ${created.legalName}`,
      },
    }),
  ]);

  return created;
}

export async function updateClient(ctx: AuthContext, clientId: string, input: unknown) {
  await requireClient(ctx, clientId);
  const data = clientSchema.partial().parse(input);

  if (data.managerCin && ctx.cabinet.cndpMode !== "authorization") {
    throw new ForbiddenError(
      "CIN refusée en mode déclaration",
      "Votre cabinet est en mode « déclaration » : le numéro de CIN ne peut pas être enregistré.",
    );
  }

  const updated = await ctx.db.client.update({ where: { id: clientId }, data });

  await recordAudit({
    action: "client.updated",
    cabinetId: ctx.cabinet.id,
    userId: ctx.user.id,
    resourceType: "Client",
    resourceId: clientId,
    metadata: { fields: Object.keys(data) },
    ip: ctx.ip,
    userAgent: ctx.userAgent,
  });

  return updated;
}

export async function archiveClient(ctx: AuthContext, clientId: string) {
  await requireClient(ctx, clientId);
  const archived = await ctx.db.client.update({
    where: { id: clientId },
    data: { status: "archived" },
  });
  await recordAudit({
    action: "client.archived",
    cabinetId: ctx.cabinet.id,
    userId: ctx.user.id,
    resourceType: "Client",
    resourceId: clientId,
    ip: ctx.ip,
    userAgent: ctx.userAgent,
  });
  return archived;
}

const assignSchema = z.object({
  clientId: z.string().min(1),
  userId: z.string().min(1),
  role: z.enum(["responsible", "reviewer", "contributor"]).default("responsible"),
});

export async function assignCollaborator(ctx: AuthContext, input: unknown) {
  const data = assignSchema.parse(input);
  await requireClient(ctx, data.clientId);

  // L'utilisateur assigné doit être membre actif du même cabinet.
  const member = await ctx.db.membership.findFirst({
    where: { userId: data.userId, status: "active" },
  });
  if (!member) throw new ForbiddenError("Utilisateur hors du cabinet");

  const assignment = await ctx.db.clientAssignment.upsert({
    where: { clientId_userId: { clientId: data.clientId, userId: data.userId } },
    create: {
      cabinetId: ctx.cabinet.id,
      clientId: data.clientId,
      userId: data.userId,
      role: data.role,
    },
    update: { role: data.role },
  });

  await recordAudit({
    action: "client.assigned",
    cabinetId: ctx.cabinet.id,
    userId: ctx.user.id,
    resourceType: "Client",
    resourceId: data.clientId,
    metadata: { assignedTo: data.userId, role: data.role },
    ip: ctx.ip,
  });

  return assignment;
}
