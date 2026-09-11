import { clsx } from "clsx";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireStaff } from "@/lib/authz/guard";
import { GRANTABLE, PERMISSION_GROUPS } from "@/lib/authz/permissions";
import { roleName } from "@/lib/domain/labels";
import { formatDate, formatDateTime } from "@/lib/format";
import {
  editableMember,
  listMemberActivity,
  listMembers,
  listStaffOptions,
} from "@/server/services/members";
import { listClientOptions } from "@/server/services/clients";
import { listTodos, todoCounts } from "@/server/services/todos";
import { Badge, Button, Card, EmptyState, Icon, PageHeader, StatTile } from "@/components/ui";
import { TodoCard, TodoForm } from "../../todos/TodoCard";
import { EditRights } from "../TeamControls";

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
  const grantable = GRANTABLE.filter((permission) => ctx.can(permission));
  const held = new Set(member.permissions);
  const editable = editableMember(member);
  // Mêmes verrous que le tableau de l'équipe, que le service applique de toute façon.
  const canEditRights =
    ctx.can("member.manage") &&
    !member.isSelf &&
    editable !== null &&
    member.permissions.every((permission) => ctx.can(permission));

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
        subtitle={`${roleName(member.role, member.roleLabel)} · ${member.email}`}
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

      <Card
        icon="shield"
        title="Rôle et droits"
        description={
          member.role === "owner"
            ? "Propriétaire : tous les droits, y compris la suppression du cabinet. Ils se transmettent, ils ne se retirent pas."
            : `${roleName(member.role, member.roleLabel)}${member.adjusted ? " (ajusté)" : ""} · ${member.permissions.length} droits sur ${GRANTABLE.length} · ${member.restrictedToAssigned ? "dossiers assignés seulement" : "tous les dossiers"}`
        }
        action={
          canEditRights && editable ? <EditRights member={editable} grantable={grantable} /> : null
        }
      >
        <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
          {PERMISSION_GROUPS.map((group) => {
            const count = group.items.filter((item) => held.has(item.permission)).length;
            return (
              <div key={group.key} className="rounded-chip border border-line p-2.5">
                <p className="mb-1.5 flex items-center justify-between gap-2 text-xs font-650 text-ink2">
                  {group.title}
                  <span className="tabular font-normal text-muted">
                    {count}/{group.items.length}
                  </span>
                </p>
                <ul className="grid gap-1">
                  {group.items.map((item) => {
                    const has = held.has(item.permission);
                    return (
                      <li
                        key={item.permission}
                        className={clsx("flex items-start gap-1.5 text-xs", has ? "text-ink" : "text-muted")}
                      >
                        <Icon
                          name={has ? "check" : "x"}
                          size={13}
                          className={clsx("mt-px shrink-0", has ? "text-accent" : "text-muted")}
                        />
                        <span>
                          <span className="sr-only">{has ? "Accordé : " : "Non accordé : "}</span>
                          {item.label}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
        </div>
      </Card>

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
