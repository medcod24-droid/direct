import { recordAudit } from "@/lib/audit";
import type { AuthContext } from "@/lib/authz/guard";
import { requireClient } from "@/lib/authz/guard";
import { NotFoundError } from "@/lib/errors";
import { notify } from "@/lib/notifications/service";
import { taskSchema } from "@/lib/validation/schemas";

export async function listTasks(
  ctx: AuthContext,
  filters: { clientId?: string; assigneeId?: string; status?: string; mine?: boolean } = {},
) {
  const where: Record<string, unknown> = {};
  if (filters.clientId) where.clientId = filters.clientId;
  if (filters.mine) where.assigneeId = ctx.user.id;
  else if (filters.assigneeId) where.assigneeId = filters.assigneeId;
  if (filters.status === "open") where.status = { notIn: ["done", "cancelled"] };
  else if (filters.status && filters.status !== "all") where.status = filters.status;

  return ctx.db.task.findMany({
    where,
    orderBy: [{ status: "asc" }, { dueDate: "asc" }],
    include: {
      client: { select: { id: true, legalName: true } },
      assignee: { select: { id: true, name: true } },
    },
    take: 300,
  });
}

export async function createTask(ctx: AuthContext, input: unknown) {
  const data = taskSchema.parse(input);
  if (data.clientId) await requireClient(ctx, data.clientId);

  if (data.assigneeId) await assertMember(ctx, data.assigneeId);

  const task = await ctx.db.task.create({
    data: {
      cabinetId: ctx.cabinet.id,
      clientId: data.clientId ?? null,
      title: data.title,
      description: data.description ?? null,
      priority: data.priority,
      status: data.status,
      dueDate: data.dueDate ?? null,
      assigneeId: data.assigneeId ?? null,
      createdById: ctx.user.id,
    },
  });

  await recordAudit({
    action: "task.created",
    cabinetId: ctx.cabinet.id,
    userId: ctx.user.id,
    resourceType: "Task",
    resourceId: task.id,
    metadata: { title: task.title },
    ip: ctx.ip,
  });

  if (data.assigneeId && data.assigneeId !== ctx.user.id) {
    await notify(ctx.cabinet.id, data.assigneeId, {
      type: "task.assigned",
      title: "Tâche assignée",
      body: task.title,
      link: `/tasks/${task.id}`,
    });
  }

  return task;
}

export async function updateTask(ctx: AuthContext, taskId: string, input: unknown) {
  const existing = await ctx.db.task.findFirst({ where: { id: taskId } });
  if (!existing) throw new NotFoundError("Tâche");

  const data = taskSchema.partial().parse(input);
  if (data.clientId) await requireClient(ctx, data.clientId);
  if (data.assigneeId) await assertMember(ctx, data.assigneeId);

  const completedAt =
    data.status === "done" ? (existing.completedAt ?? new Date()) : data.status ? null : existing.completedAt;

  const task = await ctx.db.task.update({
    where: { id: taskId },
    data: { ...data, completedAt },
  });

  await recordAudit({
    action: "task.updated",
    cabinetId: ctx.cabinet.id,
    userId: ctx.user.id,
    resourceType: "Task",
    resourceId: taskId,
    metadata: { fields: Object.keys(data) },
    ip: ctx.ip,
  });

  return task;
}

export async function addComment(ctx: AuthContext, taskId: string, body: string) {
  const task = await ctx.db.task.findFirst({ where: { id: taskId } });
  if (!task) throw new NotFoundError("Tâche");

  return ctx.db.taskComment.create({
    data: {
      cabinetId: ctx.cabinet.id,
      taskId,
      authorId: ctx.user.id,
      body: body.trim().slice(0, 4000),
    },
  });
}

/** Un utilisateur ne peut être assigné que s'il est membre actif du même cabinet. */
async function assertMember(ctx: AuthContext, userId: string) {
  const member = await ctx.db.membership.findFirst({
    where: { userId, status: "active", role: { not: "client" } },
  });
  if (!member) throw new NotFoundError("Collaborateur");
}
