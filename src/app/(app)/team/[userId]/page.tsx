import Link from "next/link";
import { notFound } from "next/navigation";
import { requireStaff } from "@/lib/authz/guard";
import { ROLE_LABELS } from "@/lib/domain/labels";
import { formatDate, formatDateTime } from "@/lib/format";
import { listMemberActivity, listMembers } from "@/server/services/members";
import { listClientOptions } from "@/server/services/clients";
import { listStaffOptions } from "@/server/services/members";
import { listTodos, todoCounts } from "@/server/services/todos";
import { Badge, Button, Card, EmptyState, PageHeader, StatTile } from "@/components/ui";
import { TodoCard, TodoForm } from "../../todos/TodoCard";

export const metadata = { title: "Collaborateur — Direct Conseil" };
export const dynamic = "force-dynamic";

/**
 * Fiche d'un collaborateur : ce qu'on lui a confié, et ce qu'il a fait.
 *
 * L'historique vient du journal d'audit, pas du fil d'activité : l'audit
 * enregistre **tout**, y compris les modifications, qui sont précisément ce que
 * l'administrateur veut pouvoir relire. La page entière demande `member.view`,
 * réservée à l'administration.
 */
export default async function MemberPage({ params }: { params: Promise<{ userId: string }> }) {
  const ctx = await requireStaff("member.view");
  const { userId } = await params;

  const members = await listMembers(ctx);
  const member = members.find((row) => row.userId === userId);
  if (!member) notFound();

  const canManageTodos = ctx.can("todo.manage");
  const [activity, todos, counts, staff, clients] = await Promise.all([
    listMemberActivity(ctx, userId),
    canManageTodos ? listTodos(ctx, { assigneeId: userId }) : Promise.resolve([]),
    canManageTodos ? todoCounts(ctx, userId) : Promise.resolve(null),
    canManageTodos ? listStaffOptions(ctx) : Promise.resolve([]),
    canManageTodos ? listClientOptions(ctx) : Promise.resolve([]),
  ]);

  return (
    <div className="grid gap-5">
      <PageHeader
        title={member.name}
        subtitle={`${ROLE_LABELS[member.role] ?? member.role} · ${member.email}`}
        actions={
          <div className="flex items-center gap-2">
            {member.restrictedToAssigned ? <Badge>Dossiers assignés seulement</Badge> : null}
            <Button href="/team" variant="ghost" size="sm">
              Retour à l&apos;équipe
            </Button>
          </div>
        }
      />

      {counts ? (
        <section className="grid gap-3 sm:grid-cols-4">
          <StatTile label="À faire" icon="task" value={String(counts.assigned)} />
          <StatTile
            label="Renvoyées"
            icon="alert"
            value={String(counts.returned)}
            tone={counts.returned > 0 ? "danger" : "neutral"}
          />
          <StatTile
            label="À confirmer"
            icon="clock"
            value={String(counts.submitted)}
            tone={counts.submitted > 0 ? "warning" : "neutral"}
          />
          <StatTile label="Confirmées" icon="check" value={String(counts.approved)} tone="success" />
        </section>
      ) : null}

      {canManageTodos ? (
        <Card
          icon="task"
          title="Tâches confiées"
          description="Ce que le cabinet attend de ce collaborateur."
          action={
            <TodoForm
              staff={staff}
              clients={clients}
              defaultAssigneeId={userId}
              trigger="Confier une tâche"
            />
          }
        >
          {todos.length === 0 ? (
            <EmptyState
              title="Aucune tâche confiée"
              description="Les tâches que vous lui confiez apparaîtront ici et sur son tableau de bord."
            />
          ) : (
            <div className="grid gap-2">
              {todos.map((todo) => (
                <TodoCard
                  key={todo.id}
                  todo={todo}
                  canManage
                  isMine={todo.assigneeId === ctx.user.id}
                  staff={staff}
                  clients={clients}
                />
              ))}
            </div>
          )}
        </Card>
      ) : null}

      <Card
        icon="clock"
        iconTone="neutral"
        title="Historique"
        description="Tout ce que ce collaborateur a fait sur la plateforme, du plus récent au plus ancien."
      >
        {activity.length === 0 ? (
          <EmptyState
            title="Aucune activité"
            description="Rien n'a encore été enregistré pour ce collaborateur."
          />
        ) : (
          <ol className="divide-y divide-line">
            {activity.map((entry) => (
              <li key={entry.id} className="flex flex-wrap items-baseline justify-between gap-2 py-2">
                <div className="min-w-0">
                  <span className="text-sm">
                    {member.name} {entry.label}
                  </span>
                  {entry.clientName ? (
                    <span className="text-sm text-muted">
                      {" — "}
                      {entry.resourceType === "Client" && entry.resourceId ? (
                        <Link
                          href={`/clients/${entry.resourceId}`}
                          className="underline underline-offset-2"
                        >
                          {entry.clientName}
                        </Link>
                      ) : (
                        entry.clientName
                      )}
                    </span>
                  ) : null}
                  {entry.outcome !== "success" ? (
                    <Badge tone="red" className="ms-2">
                      refusé
                    </Badge>
                  ) : null}
                </div>
                <span className="shrink-0 text-xs tabular text-muted">
                  {formatDateTime(entry.createdAt)}
                </span>
              </li>
            ))}
          </ol>
        )}
      </Card>

      <p className="text-xs text-muted">
        Dernière connexion :{" "}
        {member.lastLoginAt ? formatDate(member.lastLoginAt) : "jamais"}.
      </p>
    </div>
  );
}
