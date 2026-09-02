import Link from "next/link";
import { requireStaff } from "@/lib/authz/guard";
import { formatDate, relativeDays } from "@/lib/format";
import { listTasks } from "@/server/services/tasks";
import { Card, EmptyState, PageHeader, StatusPill } from "@/components/ui";

export const metadata = { title: "Tâches — Daftar" };
export const dynamic = "force-dynamic";

export default async function TasksPage({
  searchParams,
}: {
  searchParams: Promise<{ scope?: string }>;
}) {
  const ctx = await requireStaff("task.view");
  const params = await searchParams;
  const mine = params.scope !== "team";
  const tasks = await listTasks(ctx, { mine, status: "open" });

  return (
    <div className="grid gap-5">
      <PageHeader
        title="Tâches"
        subtitle={mine ? "Mes tâches ouvertes" : "Tâches de l'équipe"}
      />

      <nav className="flex gap-2 text-sm">
        <Link
          href="/tasks"
          className={`px-3 py-1.5 rounded-md border ${mine ? "border-accent text-accentInk bg-accentSoft" : "border-line text-ink2"}`}
        >
          Mes tâches
        </Link>
        <Link
          href="/tasks?scope=team"
          className={`px-3 py-1.5 rounded-md border ${!mine ? "border-accent text-accentInk bg-accentSoft" : "border-line text-ink2"}`}
        >
          Équipe
        </Link>
      </nav>

      <Card>
        {tasks.length === 0 ? (
          <EmptyState title="Aucune tâche ouverte" description="Rien ne vous attend pour le moment." />
        ) : (
          <ul className="divide-y divide-line">
            {tasks.map((task) => (
              <li key={task.id} className="py-2.5 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-sm">{task.title}</div>
                  <div className="text-xs text-muted">
                    {task.client ? (
                      <Link href={`/clients/${task.client.id}`} className="underline underline-offset-2">
                        {task.client.legalName}
                      </Link>
                    ) : (
                      "Tâche interne"
                    )}
                    {task.dueDate ? ` · ${formatDate(task.dueDate)} (${relativeDays(task.dueDate)})` : ""}
                    {task.assignee ? ` · ${task.assignee.name}` : ""}
                  </div>
                </div>
                <StatusPill status={task.status} />
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
