import { z } from "zod";
import { recordAudit } from "@/lib/audit";
import type { AuthContext } from "@/lib/authz/guard";
import { platformDb } from "@/lib/db/tenant";
import { ForbiddenError, NotFoundError, ValidationError } from "@/lib/errors";

export const TODO_STATUSES = ["assigned", "submitted", "approved", "returned"] as const;

/**
 * Liste de tâches de l'équipe.
 *
 * L'administrateur distribue le travail ; le collaborateur rend la tâche avec
 * une note — faite, ou ce qui manque — et elle passe en attente ; c'est
 * l'administrateur qui la clôt, après avoir lu la note. Trois états visibles,
 * trois couleurs : confiée, rendue (orange), confirmée (vert).
 *
 * La tâche ne se supprime pas d'elle-même à la validation : ce va-et-vient est
 * précisément ce que l'administrateur veut voir.
 */
const todoSchema = z.object({
  assigneeId: z.string().min(1, "Choisissez le collaborateur."),
  title: z.string().trim().min(2, "Intitulé de la tâche requis.").max(200),
  details: z
    .string()
    .trim()
    .max(2000)
    .optional()
    .transform((v) => (v === "" ? undefined : v)),
  dueDate: z.coerce.date().optional(),
  priority: z.enum(["low", "normal", "high", "urgent"]).default("normal"),
  clientId: z
    .string()
    .trim()
    .max(40)
    .optional()
    .transform((v) => (v === "" ? undefined : v)),
});

const noteSchema = z.object({
  note: z.string().trim().max(2000).optional().transform((v) => (v === "" ? undefined : v)),
});

export type TodoFilters = {
  /** Restreint à un collaborateur. */
  assigneeId?: string;
  status?: string;
};

export async function listTodos(ctx: AuthContext, filters: TodoFilters = {}) {
  const where: Record<string, unknown> = {};

  // Sans `todo.manage`, on ne voit que ce qui nous est confié : la liste des
  // autres n'est pas une information d'équipe, c'est la répartition du travail.
  if (!ctx.can("todo.manage")) where.assigneeId = ctx.user.id;
  else if (filters.assigneeId) where.assigneeId = filters.assigneeId;

  if (filters.status && filters.status !== "all") where.status = filters.status;

  const todos = await ctx.db.todo.findMany({
    where,
    orderBy: [{ status: "asc" }, { dueDate: "asc" }, { createdAt: "desc" }],
    include: { client: { select: { id: true, legalName: true } } },
  });

  return withNames(todos);
}

/** Tâches confiées à l'utilisateur courant, pour son tableau de bord. */
export async function listMyTodos(ctx: AuthContext, limit = 10) {
  const todos = await ctx.db.todo.findMany({
    where: { assigneeId: ctx.user.id, status: { in: ["assigned", "returned"] } },
    orderBy: [{ dueDate: "asc" }, { createdAt: "desc" }],
    take: limit,
    include: { client: { select: { id: true, legalName: true } } },
  });
  return withNames(todos);
}

/** Tâches rendues, en attente de la confirmation de l'administrateur. */
export async function listAwaitingApproval(ctx: AuthContext, limit = 20) {
  if (!ctx.can("todo.manage")) return [];
  const todos = await ctx.db.todo.findMany({
    where: { status: "submitted" },
    orderBy: { submittedAt: "asc" },
    take: limit,
    include: { client: { select: { id: true, legalName: true } } },
  });
  return withNames(todos);
}

/** Compte par état, pour un collaborateur : lu sur sa fiche d'équipe. */
export async function todoCounts(ctx: AuthContext, assigneeId: string) {
  const rows = await ctx.db.todo.groupBy({
    by: ["status"],
    where: { assigneeId },
    _count: { _all: true },
  });
  const counts = { assigned: 0, submitted: 0, approved: 0, returned: 0 };
  for (const row of rows) {
    if (row.status in counts) counts[row.status as keyof typeof counts] = row._count._all;
  }
  return counts;
}

export async function createTodo(ctx: AuthContext, input: unknown) {
  const data = todoSchema.parse(input);
  await assertMember(ctx, data.assigneeId);
  if (data.clientId) await assertClient(ctx, data.clientId);

  const created = await ctx.db.todo.create({
    data: {
      cabinetId: ctx.cabinet.id,
      assigneeId: data.assigneeId,
      clientId: data.clientId ?? null,
      title: data.title,
      details: data.details ?? null,
      dueDate: data.dueDate ?? null,
      priority: data.priority,
      status: "assigned",
      createdById: ctx.user.id,
    },
  });

  await recordAudit({
    action: "todo.created",
    cabinetId: ctx.cabinet.id,
    userId: ctx.user.id,
    resourceType: "Todo",
    resourceId: created.id,
    metadata: { assigneeId: data.assigneeId, title: data.title },
    ip: ctx.ip,
    userAgent: ctx.userAgent,
  });

  return created;
}

export async function updateTodo(ctx: AuthContext, todoId: string, input: unknown) {
  const existing = await find(ctx, todoId);
  const data = todoSchema.parse(input);
  await assertMember(ctx, data.assigneeId);
  if (data.clientId) await assertClient(ctx, data.clientId);

  const updated = await ctx.db.todo.update({
    where: { id: todoId },
    data: {
      assigneeId: data.assigneeId,
      clientId: data.clientId ?? null,
      title: data.title,
      details: data.details ?? null,
      dueDate: data.dueDate ?? null,
      priority: data.priority,
    },
  });

  await recordAudit({
    action: "todo.updated",
    cabinetId: ctx.cabinet.id,
    userId: ctx.user.id,
    resourceType: "Todo",
    resourceId: todoId,
    metadata: { assigneeId: existing.assigneeId },
    ip: ctx.ip,
    userAgent: ctx.userAgent,
  });

  return updated;
}

/**
 * Le collaborateur rend sa tâche.
 *
 * La note est exigée : « fait » ou « il manque ceci » est justement ce que
 * l'administrateur lira avant de confirmer, et une tâche rendue sans un mot ne
 * lui apprendrait rien.
 */
export async function submitTodo(ctx: AuthContext, todoId: string, input: unknown) {
  const existing = await find(ctx, todoId);
  if (existing.assigneeId !== ctx.user.id) {
    throw new ForbiddenError("Cette tâche est confiée à un autre collaborateur.");
  }
  if (existing.status === "approved") {
    throw new ValidationError("Cette tâche est déjà confirmée.");
  }

  const { note } = noteSchema.parse(input);
  if (!note) throw new ValidationError("Notez ce qui a été fait, ou ce qui manque.");

  const updated = await ctx.db.todo.update({
    where: { id: todoId },
    data: { status: "submitted", submittedNote: note, submittedAt: new Date(), reviewNote: null },
  });

  await recordAudit({
    action: "todo.submitted",
    cabinetId: ctx.cabinet.id,
    userId: ctx.user.id,
    resourceType: "Todo",
    resourceId: todoId,
    metadata: { title: existing.title },
    ip: ctx.ip,
    userAgent: ctx.userAgent,
  });

  return updated;
}

/** L'administrateur confirme : la tâche passe au vert, des deux côtés. */
export async function approveTodo(ctx: AuthContext, todoId: string) {
  const existing = await find(ctx, todoId);
  if (existing.status !== "submitted") {
    throw new ValidationError("Seule une tâche rendue peut être confirmée.");
  }

  const updated = await ctx.db.todo.update({
    where: { id: todoId },
    data: { status: "approved", approvedAt: new Date(), approvedById: ctx.user.id },
  });

  await recordAudit({
    action: "todo.approved",
    cabinetId: ctx.cabinet.id,
    userId: ctx.user.id,
    resourceType: "Todo",
    resourceId: todoId,
    metadata: { assigneeId: existing.assigneeId, title: existing.title },
    ip: ctx.ip,
    userAgent: ctx.userAgent,
  });

  return updated;
}

/**
 * L'administrateur renvoie la tâche.
 *
 * Le collaborateur qui écrit « il manque une pièce » n'a pas terminé : confirmer
 * serait faux, et sans ce retour l'administrateur n'aurait d'autre choix que de
 * clore une tâche inachevée. Le motif du renvoi est exigé.
 */
export async function returnTodo(ctx: AuthContext, todoId: string, input: unknown) {
  const existing = await find(ctx, todoId);
  if (existing.status !== "submitted") {
    throw new ValidationError("Seule une tâche rendue peut être renvoyée.");
  }

  const { note } = noteSchema.parse(input);
  if (!note) throw new ValidationError("Dites ce qu'il reste à faire.");

  const updated = await ctx.db.todo.update({
    where: { id: todoId },
    data: { status: "returned", reviewNote: note },
  });

  await recordAudit({
    action: "todo.returned",
    cabinetId: ctx.cabinet.id,
    userId: ctx.user.id,
    resourceType: "Todo",
    resourceId: todoId,
    metadata: { assigneeId: existing.assigneeId },
    ip: ctx.ip,
    userAgent: ctx.userAgent,
  });

  return updated;
}

export async function deleteTodo(ctx: AuthContext, todoId: string) {
  const existing = await find(ctx, todoId);
  await ctx.db.todo.delete({ where: { id: todoId } });

  await recordAudit({
    action: "todo.deleted",
    cabinetId: ctx.cabinet.id,
    userId: ctx.user.id,
    resourceType: "Todo",
    resourceId: todoId,
    metadata: { assigneeId: existing.assigneeId, title: existing.title },
    ip: ctx.ip,
    userAgent: ctx.userAgent,
  });

  return existing;
}

async function find(ctx: AuthContext, todoId: string) {
  const found = await ctx.db.todo.findFirst({ where: { id: todoId } });
  if (!found) throw new NotFoundError("Tâche");
  return found;
}

/** Le collaborateur visé doit être membre actif du cabinet. */
async function assertMember(ctx: AuthContext, userId: string) {
  const member = await ctx.db.membership.findFirst({
    where: { userId, status: "active" },
    select: { role: true },
  });
  if (!member) throw new ForbiddenError("Collaborateur hors du cabinet");
  if (member.role === "client") {
    throw new ForbiddenError("Une tâche d'équipe ne se confie pas à un compte client.");
  }
}

/** Le dossier vient du navigateur : il est relu à travers le client du contexte. */
async function assertClient(ctx: AuthContext, clientId: string) {
  const client = await ctx.db.client.findFirst({ where: { id: clientId }, select: { id: true } });
  if (!client) throw new ValidationError("Dossier introuvable dans le cabinet.");
}

/**
 * Noms des collaborateurs concernés.
 *
 * `User` n'appartient pas à un cabinet : il est lu par `platformDb`, borné aux
 * seuls identifiants déjà rapportés par des lignes du cabinet.
 */
async function withNames<T extends { assigneeId: string; approvedById: string | null }>(rows: T[]) {
  const ids = [...new Set(rows.flatMap((row) => [row.assigneeId, row.approvedById ?? ""]))].filter(
    Boolean,
  );
  const users = await platformDb.user.findMany({
    where: { id: { in: ids } },
    select: { id: true, name: true },
  });
  const byId = new Map(users.map((user) => [user.id, user.name]));

  return rows.map((row) => ({
    ...row,
    assigneeName: byId.get(row.assigneeId) ?? "—",
    approvedByName: row.approvedById ? byId.get(row.approvedById) ?? null : null,
  }));
}
