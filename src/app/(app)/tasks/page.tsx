import Link from "next/link";
import { requireStaff } from "@/lib/authz/guard";
import { platformDb } from "@/lib/db/tenant";
import { formatDate, relativeDays } from "@/lib/format";
import { listTasks } from "@/server/services/tasks";
import { PRIORITY_LABELS } from "@/lib/domain/labels";
import { Badge, Card, EmptyState, PageHeader, StatusPill } from "@/components/ui";
import { NewTaskForm } from "./NewTaskForm";
import { CompleteTaskButton } from "./TaskRowActions";

export const metadata = { title: "Tâches — Direct Conseil" };
export const dynamic = "force-dynamic";

export default async function TasksPage({
  searchParams,
}: {
  searchParams: Promise<{ scope?: string }>;
}) {
  const ctx = await requireStaff("task.view");
  const params = await searchParams;
  const mine = params.scope !== "team";
  const now = new Date();
  const [tasks, clients, memberships] = await Promise.all([
    listTasks(ctx, { mine, status: "open" }),
    ctx.db.client.findMany({
      where: { status: { not: "archived" } },
      select: { id: true, legalName: true },
      orderBy: { legalName: "asc" },
    }),
    ctx.db.membership.findMany({ where: { status: "active", role: { not: "client" } } }),
  ]);
  const users = await platformDb.user.findMany({
    where: { id: { in: memberships.map((m) => m.userId) } },
    select: { id: true, name: true },
  });

  return (
    <div className="grid gap-5">
      <PageHeader
        title="Tâches"
        subtitle={mine ? "Mes tâches ouvertes" : "Tâches de l'équipe"}
      />

      <nav className="flex gap-2 text-sm">
        <Link
          href="/tasks"
          className={`px-3 py-1.5 rounded-md border ${mine ? "border-accent text-accent bg-accentSoft" : "border-line text-ink2"}`}
        >
          Mes tâches
        </Link>
        <Link
          href="/tasks?scope=team"
          className={`px-3 py-1.5 rounded-md border ${!mine ? "border-accent text-accent bg-accentSoft" : "border-line text-ink2"}`}
        >
          Équipe
        </Link>
      </nav>

      {ctx.can("task.create") ? (
        <NewTaskForm
          clients={clients.map((c) => ({ id: c.id, label: c.legalName }))}
          members={users.map((u) => ({ id: u.id, label: u.name }))}
        />
      ) : null}

      <Card>
        {tasks.length === 0 ? (
          <EmptyState title="Aucune tâche ouverte" description="Rien ne vous attend pour le moment." />
        ) : (
          <ul className="divide-y divide-line">
            {tasks.map((task) => (
              <li key={task.id} className="flex items-center justify-between gap-3 py-2.5">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    {task.priority === "urgent" || task.priority === "high" ? (
                      <Badge tone={task.priority === "urgent" ? "red" : "amber"}>
                        {PRIORITY_LABELS[task.priority]}
                      </Badge>
                    ) : null}
                    <span className="text-sm">{task.title}</span>
                  </div>
                  <div className="mt-0.5 text-xs text-muted">
                    {task.client ? (
                      <Link href={`/clients/${task.client.id}`} className="underline underline-offset-2">
                        {task.client.legalName}
                      </Link>
                    ) : (
                      "Tâche interne"
                    )}
                    {task.dueDate ? (
                      <span className={task.dueDate < now ? "text-danger" : undefined}>
                        {" · "}
                        {formatDate(task.dueDate)} ({relativeDays(task.dueDate)})
                      </span>
                    ) : (
                      " · sans échéance"
                    )}
                    {task.assignee ? ` · ${task.assignee.name}` : ""}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <StatusPill status={task.status} />
                  {ctx.can("task.update") ? <CompleteTaskButton id={task.id} /> : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
