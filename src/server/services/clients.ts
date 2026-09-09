import { randomUUID } from "node:crypto";
import { z } from "zod";
import { recordAudit } from "@/lib/audit";
import type { AuthContext } from "@/lib/authz/guard";
import { requireClient } from "@/lib/authz/guard";
import { assertWithinLimit } from "@/lib/billing/entitlements";
import { computeHealth, type HealthResult } from "@/lib/domain/health";
import { ForbiddenError } from "@/lib/errors";
import { rateClient, volumePercentile, type Rating } from "@/lib/clients/rating";
import { clientCreateSchema, clientUpdateSchema, searchSchema } from "@/lib/validation/schemas";

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
  if (status && status !== "all") {
    where.status = status;
  } else if (!status) {
    // Un dossier archivé n'est plus suivi : il sort des listes par défaut, sinon
    // l'archivage n'aurait aucun effet visible. Il reste atteignable par le
    // filtre « Archivé » ou « Tous les statuts ».
    where.status = { not: "archived" };
  }
  if (q) {
    // SQLite ne connaît pas `mode: "insensitive"` : la recherche reste sensible à la casse
    // sur cette base. En production (PostgreSQL), activer un index trigram ou citext.
    where.OR = [
      { legalName: { contains: q } },
      { tradeName: { contains: q } },
      { ice: { contains: q } },
      { if: { contains: q } },
      { rc: { contains: q } },
      // Les projections plates existent pour cela : retrouver un dossier par le
      // numéro d'une succursale ou d'une taxe professionnelle, sans ouvrir l'arbre.
      { branches: { contains: q } },
      { taxProfNos: { contains: q } },
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

type WithId = { id?: string };
type TaxProf = WithId & { value: string };
type Branch = WithId & { number: string; court?: string; taxProfNos: TaxProf[] };
type Registration = WithId & {
  number: string;
  court?: string;
  taxProfNos: TaxProf[];
  branches: Branch[];
};

type ClientLists = Partial<{
  activities: string[];
  registrations: Registration[];
  partners: (WithId & { role: string; name: string; cin?: string; address?: string; phone?: string })[];
  employees: { name: string; cin?: string; cnssNo?: string }[];
}>;

/**
 * Identifiants de ligne, complétés et rendus uniques.
 *
 * Le navigateur en émet un à la création d'une ligne, pour que le justificatif
 * déposé dans la foulée s'y rattache. Le serveur ne s'y fie pas : un identifiant
 * absent ou déjà pris est réémis ici, sinon deux lignes partageraient leurs
 * pièces.
 */
function withIds<T extends WithId>(rows: T[], seen: Set<string>): T[] {
  return rows.map((row) => {
    const id = row.id && !seen.has(row.id) ? row.id : randomUUID().slice(0, 8);
    seen.add(id);
    return { ...row, id };
  });
}

/**
 * Colonnes de listes, sérialisées en JSON comme `tags`.
 *
 * Les immatriculations sont arborescentes — registre, établissements, numéros de
 * taxe professionnelle — mais les listes et la recherche n'ont pas à parcourir
 * l'arbre : `rc`, `rcCourt`, `taxProfNo`, `taxProfNos` et `branches` en sont des
 * projections plates, reconstruites à chaque écriture. Même principe pour
 * `activity`, premier élément de sa liste, et pour `employeeCount`, déduit du
 * nombre de salariés dès que le cabinet les nomme.
 *
 * Les CIN des associés et des salariés obéissent au mode CNDP au même titre que
 * celle du gérant : sans ce filtrage, ces listes seraient devenues la voie par
 * laquelle des numéros de CIN entraient malgré le mode « déclaration ».
 */
function listColumns(data: ClientLists, cndpMode: string) {
  const columns: Record<string, unknown> = {};

  if (data.activities) {
    columns.declaredActivities = JSON.stringify(data.activities);
    columns.activity = data.activities[0] ?? "";
  }

  if (data.registrations) {
    const seen = new Set<string>();
    const registrations = withIds(data.registrations, seen).map((registration) => ({
      ...registration,
      taxProfNos: withIds(registration.taxProfNos, seen),
      branches: withIds(registration.branches, seen).map((branch) => ({
        ...branch,
        taxProfNos: withIds(branch.taxProfNos, seen),
      })),
    }));
    columns.registrations = JSON.stringify(registrations);
    columns.rc = registrations[0]?.number ?? "";
    columns.rcCourt = registrations[0]?.court ?? "";

    const establishments = registrations.flatMap((registration) => registration.branches);
    columns.branches = JSON.stringify(
      establishments.map(({ number, court }) => ({ number, court })),
    );

    const taxProfNos = registrations.flatMap((registration) => [
      ...registration.taxProfNos.map((tax) => tax.value),
      ...registration.branches.flatMap((branch) => branch.taxProfNos.map((tax) => tax.value)),
    ]);
    columns.taxProfNos = JSON.stringify(taxProfNos);
    columns.taxProfNo = taxProfNos[0] ?? "";
  }

  if (data.partners) {
    columns.partners = JSON.stringify(
      withIds(data.partners, new Set()).map((partner) => stripCin(partner, cndpMode)),
    );
  }

  if (data.employees) {
    const employees = data.employees.map((employee) => stripCin(employee, cndpMode));
    columns.employees = JSON.stringify(employees);
    // Le compte saisi à la main ne sert que tant que les salariés ne sont pas nommés.
    if (employees.length > 0) columns.employeeCount = employees.length;
  }

  return columns;
}

function stripCin<T extends { cin?: string }>(row: T, cndpMode: string): T {
  return cndpMode === "authorization" ? row : { ...row, cin: undefined };
}

/** Rejette une CIN saisie alors que le cabinet n'a pas l'autorisation CNDP. */
function assertCinAllowed(
  data: { managerCin?: string; partners?: { cin?: string }[]; employees?: { cin?: string }[] },
  cndpMode: string,
) {
  if (cndpMode === "authorization") return;
  const submitted =
    Boolean(data.managerCin) ||
    Boolean(data.partners?.some((row) => row.cin)) ||
    Boolean(data.employees?.some((row) => row.cin));
  if (submitted) {
    throw new ForbiddenError(
      "CIN refusée en mode déclaration",
      "Votre cabinet est en mode « déclaration » : le numéro de CIN ne peut pas être enregistré. Activez le mode « autorisation » dans les paramètres après votre autorisation CNDP.",
    );
  }
}

export async function createClient(ctx: AuthContext, input: unknown) {
  const data = clientCreateSchema.parse(input);
  await assertWithinLimit(ctx.cabinet.id, "clients");

  // Le numéro de CIN n'est stocké que si le cabinet a l'autorisation CNDP correspondante.
  assertCinAllowed(data, ctx.cabinet.cndpMode);
  const managerCin = ctx.cabinet.cndpMode === "authorization" ? data.managerCin : undefined;

  const { activities, registrations, partners, employees, ...scalars } = data;
  const created = await ctx.db.client.create({
    data: {
      ...scalars,
      ...listColumns({ activities, registrations, partners, employees }, ctx.cabinet.cndpMode),
      cabinetId: ctx.cabinet.id,
      managerCin,
      tags: "[]",
    },
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
  const data = clientUpdateSchema.parse(input);

  assertCinAllowed(data, ctx.cabinet.cndpMode);

  const { activities, registrations, partners, employees, ...scalars } = data;
  const updated = await ctx.db.client.update({
    where: { id: clientId },
    data: {
      ...scalars,
      ...listColumns({ activities, registrations, partners, employees }, ctx.cabinet.cndpMode),
    },
  });

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
