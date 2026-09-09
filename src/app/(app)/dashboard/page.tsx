import Link from "next/link";
import { requireStaff } from "@/lib/authz/guard";
import { daysUntil, formatDate, formatMad, relativeDays } from "@/lib/format";
import { PRIORITY_LABELS } from "@/lib/domain/labels";
import { dayKey, endOf, wallTime } from "@/lib/calendar/month";
import { listAppointments } from "@/server/services/appointments";
import { listMyTodos, listTodos } from "@/server/services/todos";
import { listStaffOptions } from "@/server/services/members";
import { listClientOptions } from "@/server/services/clients";
import { getYearResults } from "@/server/services/finances";
import { TodoCard } from "../todos/TodoCard";
import {
  getCabinetDashboard,
  getClientsNeedingAttention,
  getOverdueThisMonth,
  getUrgentTasks,
} from "@/server/services/dashboard";
import { Alert, Badge, Card, EmptyState, MonthlyBars, PageHeader } from "@/components/ui";

export const metadata = { title: "Tableau de bord — Direct Conseil" };
export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const ctx = await requireStaff("cabinet.view");
  // Journée en heures murales : les rendez-vous sont enregistrés tels qu'ils ont
  // été saisis, sans conversion de fuseau (voir lib/calendar/month.ts).
  const now = new Date();
  const dayStart = new Date(`${dayKey(now)}T00:00:00Z`);
  const dayEnd = new Date(dayStart.getTime() + 86_400_000);

  const [
    data,
    overdue,
    attention,
    urgentTasks,
    todayAppointments,
    myTodos,
    teamTodos,
    staff,
    todoClients,
    results,
  ] = await Promise.all([
      getCabinetDashboard(ctx),
      getOverdueThisMonth(ctx, now),
      getClientsNeedingAttention(ctx),
      ctx.can("task.view") ? getUrgentTasks(ctx) : Promise.resolve([]),
      ctx.can("appointment.view")
        ? listAppointments(ctx, { from: dayStart, to: dayEnd })
        : Promise.resolve([]),
      ctx.can("todo.view") ? listMyTodos(ctx) : Promise.resolve([]),
      // `listTodos` borne déjà la lecture : l'administration voit toute
      // l'équipe, un collaborateur seulement ce qui lui est confié.
      ctx.can("todo.manage") ? listTodos(ctx) : Promise.resolve([]),
      // Le formulaire de modification, ouvert depuis une carte, a besoin des
      // listes de choix.
      ctx.can("todo.manage") ? listStaffOptions(ctx) : Promise.resolve([]),
      ctx.can("todo.manage") ? listClientOptions(ctx) : Promise.resolve([]),
      ctx.can("finance.view")
        ? getYearResults(ctx, now.getUTCFullYear())
        : Promise.resolve(null),
    ]);

  const canManageTodos = ctx.can("todo.manage");
  // Regroupement par collaborateur, pour valider sans quitter le tableau de bord.
  const todoGroups = new Map<string, typeof teamTodos>();
  for (const todo of teamTodos) {
    if (todo.status === "approved") continue;
    const list = todoGroups.get(todo.assigneeId);
    if (list) list.push(todo);
    else todoGroups.set(todo.assigneeId, [todo]);
  }
  const groups = [...todoGroups.entries()]
    .map(([assigneeId, items]) => ({
      assigneeId,
      name: items[0]?.assigneeName ?? "—",
      items,
      awaiting: items.filter((item) => item.status === "submitted").length,
    }))
    .sort((a, b) => b.awaiting - a.awaiting || a.name.localeCompare(b.name, "fr"));

  const trial =
    data.entitlements?.status === "trialing" && data.entitlements.trialEndsAt
      ? relativeDays(data.entitlements.trialEndsAt)
      : null;

  return (
    <div className="grid gap-6">
      <PageHeader
        title={`Bonjour, ${ctx.user.name.split(" ")[0]}`}
        subtitle={`${data.clients.active} dossiers actifs · ${overdue.total} échéance(s) en retard ce mois-ci`}
      />

      {trial ? (
        <Alert tone="info">
          Période d&apos;essai du plan {data.entitlements?.planName} : elle se termine {trial}.{" "}
          <Link href="/settings" className="underline underline-offset-2">
            Voir les plans
          </Link>
        </Alert>
      ) : null}

      {data.warnings.map((warning) => (
        <Alert key={warning} tone="warning">
          Limite bientôt atteinte — {warning}.
        </Alert>
      ))}


      <Card
        title="Échéances en retard ce mois-ci"
        description="Gérées par le cabinet, sans preuve de dépôt. Le mois en cours seulement — l'année entière ne dit rien de ce qu'il y a à faire."
        action={
          <Link
            href="/deadlines?status=overdue"
            className="text-sm text-accent underline underline-offset-2"
          >
            Toutes les échéances
          </Link>
        }
      >
        {overdue.items.length === 0 ? (
          <EmptyState
            title="Rien en retard ce mois-ci"
            description="Les obligations du mois gérées par le cabinet sont à jour."
          />
        ) : (
          <>
            <ul className="divide-y divide-line">
              {overdue.items.map((deadline) => (
                <li key={deadline.id} className="flex items-baseline justify-between gap-3 py-2.5">
                  <div className="min-w-0">
                    <div className="text-sm">{deadline.label}</div>
                    <div className="text-xs text-muted">
                      <Link
                        href={`/clients/${deadline.client.id}`}
                        className="underline underline-offset-2"
                      >
                        {deadline.client.legalName}
                      </Link>
                      {" · "}
                      {deadline.periodLabel}
                    </div>
                  </div>
                  <div className="shrink-0 text-end text-xs">
                    <div className="font-medium text-danger tabular">
                      {formatDate(deadline.dueDate)}
                    </div>
                    <div className="text-danger">{relativeDays(deadline.dueDate)}</div>
                  </div>
                </li>
              ))}
            </ul>
            {overdue.total > overdue.items.length ? (
              <p className="mt-2 text-xs text-muted">
                {overdue.total - overdue.items.length} autre(s) en retard ce mois-ci.
              </p>
            ) : null}
          </>
        )}
      </Card>

      {myTodos.length > 0 ? (
        <Card
          title="Ce que le cabinet attend de vous"
          description="Tâches confiées par l'administration. Marquez-les comme faites en laissant une note."
          action={
            <Link href="/todos" className="text-sm text-accent underline underline-offset-2">
              Ma to-do
            </Link>
          }
        >
          <ul className="divide-y divide-line">
            {myTodos.map((todo) => (
              <li key={todo.id} className="flex items-baseline justify-between gap-3 py-2.5">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    {todo.status === "returned" ? <Badge tone="red">Renvoyée</Badge> : null}
                    {todo.priority === "urgent" ? (
                      <Badge tone="red">{PRIORITY_LABELS.urgent}</Badge>
                    ) : null}
                    <span className="text-sm">{todo.title}</span>
                  </div>
                  {todo.reviewNote ? (
                    <p className="mt-0.5 text-xs text-ink2">À reprendre : {todo.reviewNote}</p>
                  ) : null}
                </div>
                <div className="shrink-0 text-end text-xs">
                  {todo.dueDate ? (
                    <>
                      <div
                        className={
                          (daysUntil(todo.dueDate) ?? 0) < 0
                            ? "font-medium text-danger"
                            : "text-ink2"
                        }
                      >
                        {formatDate(todo.dueDate)}
                      </div>
                      <div className="text-muted">{relativeDays(todo.dueDate)}</div>
                    </>
                  ) : (
                    <span className="text-muted">sans date</span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      {canManageTodos ? (
        <Card
          title="To-do de l'équipe"
          description="Ce qui reste à faire, par collaborateur. Une tâche rendue attend votre confirmation."
          action={
            <Link href="/todos" className="text-sm text-accent underline underline-offset-2">
              Ouvrir la to-do
            </Link>
          }
        >
          {groups.length === 0 ? (
            <EmptyState
              title="Rien en cours"
              description="Tout ce qui a été confié est confirmé. Ouvrez la to-do pour distribuer le travail du jour."
            />
          ) : (
          <div className="grid gap-4">
            {groups.map((group) => (
              <div key={group.assigneeId}>
                <div className="mb-2 flex items-baseline gap-2">
                  <Link
                    href={`/team/${group.assigneeId}`}
                    className="text-sm font-medium underline underline-offset-2"
                  >
                    {group.name}
                  </Link>
                  {group.awaiting > 0 ? (
                    <Badge tone="amber">{group.awaiting} à confirmer</Badge>
                  ) : null}
                </div>
                <div className="grid gap-2">
                  {group.items.map((todo) => (
                    <TodoCard
                      key={todo.id}
                      todo={todo}
                      canManage
                      isMine={todo.assigneeId === ctx.user.id}
                      staff={staff}
                      clients={todoClients}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
          )}
        </Card>
      ) : null}

      {ctx.can("appointment.view") ? (
        <Card
          title="Rendez-vous du jour"
          description="Qui vient aujourd'hui, et ce qu'il faut avoir sorti."
          action={
            <Link href="/appointments" className="text-sm text-accent underline underline-offset-2">
              Le calendrier
            </Link>
          }
        >
          {todayAppointments.length === 0 ? (
            <EmptyState
              title="Aucun rendez-vous aujourd'hui"
              description="Le calendrier reste ouvert pour la suite du mois."
            />
          ) : (
          <ul className="divide-y divide-line">
            {todayAppointments.map((appointment) => (
              <li key={appointment.id} className="flex items-baseline justify-between gap-3 py-2.5">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="tabular text-sm font-medium">
                      {wallTime(appointment.startsAt)} –{" "}
                      {wallTime(endOf(appointment.startsAt, appointment.durationMinutes))}
                    </span>
                    {appointment.status === "done" ? <Badge tone="green">Validé</Badge> : null}
                    {appointment.status === "cancelled" ? <Badge>Annulé</Badge> : null}
                    {appointment.status === "no_show" ? <Badge tone="red">Absent</Badge> : null}
                    <span className="text-sm">{appointment.title}</span>
                  </div>
                  <div className="mt-0.5 text-xs text-muted">
                    <Link
                      href={`/clients/${appointment.client.id}`}
                      className="underline underline-offset-2"
                    >
                      {appointment.client.legalName}
                    </Link>
                    {appointment.assignedTo ? ` · reçu par ${appointment.assignedTo.name}` : ""}
                  </div>
                  {appointment.preparation ? (
                    <p className="mt-0.5 whitespace-pre-line text-xs text-ink2">
                      À préparer : {appointment.preparation}
                    </p>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
          )}
        </Card>
      ) : null}

      {urgentTasks.length > 0 ? (
        <Card
          title="À ne pas oublier"
          description="Tâches urgentes, en retard, ou à faire sous 48 heures."
          action={
            <Link href="/tasks?scope=team" className="text-sm text-accent underline underline-offset-2">
              Toutes les tâches
            </Link>
          }
        >
          <ul className="divide-y divide-line">
            {urgentTasks.map((task) => (
              <li key={task.id} className="flex items-center justify-between gap-3 py-2.5">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    {task.priority === "urgent" ? (
                      <Badge tone="red">{PRIORITY_LABELS.urgent}</Badge>
                    ) : null}
                    <span className="text-sm">{task.title}</span>
                  </div>
                  <div className="mt-0.5 text-xs text-muted">
                    {task.client ? (
                      <Link
                        href={`/clients/${task.client.id}`}
                        className="underline underline-offset-2"
                      >
                        {task.client.legalName}
                      </Link>
                    ) : (
                      "Tâche interne"
                    )}
                    {task.assignee ? ` · ${task.assignee.name}` : " · non assignée"}
                  </div>
                </div>
                <div className="shrink-0 text-end text-xs">
                  {task.dueDate ? (
                    <>
                      <div className={task.overdue ? "font-medium text-danger" : "text-ink2"}>
                        {formatDate(task.dueDate)}
                      </div>
                      <div className={task.overdue ? "text-danger" : "text-muted"}>
                        {relativeDays(task.dueDate)}
                      </div>
                    </>
                  ) : (
                    <span className="text-muted">sans échéance</span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      <section className="grid gap-4 lg:grid-cols-3">
        <Card title="Dossiers à surveiller" className="lg:col-span-2">
          {attention.length === 0 ? (
            <EmptyState
              title="Aucun dossier en retard"
              description="Toutes les échéances gérées par le cabinet sont à jour."
            />
          ) : (
            <ul className="divide-y divide-line">
              {attention.map(({ client, overdue }) => (
                <li key={client.id} className="py-2.5 flex items-center justify-between gap-3">
                  <Link
                    href={`/clients/${client.id}`}
                    className="text-sm font-medium hover:underline underline-offset-2"
                  >
                    {client.legalName}
                  </Link>
                  <span className="text-sm text-danger tabular">{overdue} en retard</span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="Activité récente">
          {data.activity.length === 0 ? (
            <EmptyState title="Rien pour l'instant" description="L'activité du cabinet apparaîtra ici." />
          ) : (
            <ul className="grid gap-2.5">
              {data.activity.map((item) => (
                <li key={item.id} className="text-sm">
                  <div className="text-ink2">{item.summary}</div>
                  <div className="text-xs text-muted">
                    {item.client ? `${item.client.legalName} · ` : ""}
                    {/* Qui a fait quoi : l'auteur est enregistré depuis le début,
                        il n'était simplement pas affiché. */}
                    {item.actorName ? `${item.actorName} · ` : ""}
                    {relativeDays(item.createdAt)}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </section>

      {results ? (
        <Card
          title={`Résultat du cabinet — ${results.year}`}
          description={
            results.totals.monthsFilled === 0
              ? "Aucun mois saisi. Renseignez vos revenus et vos charges pour suivre où va le cabinet."
              : `${results.totals.monthsFilled} mois saisi(s) · cumul ${formatMad(results.totals.result)}`
          }
          action={
            <Link href="/resultats" className="text-sm text-accent underline underline-offset-2">
              Saisir un mois
            </Link>
          }
        >
          <MonthlyBars months={results.months} />
        </Card>
      ) : null}

      <Card title="Le cabinet en chiffres" padded={false}>
        <dl className="grid grid-cols-2 divide-line sm:grid-cols-4 sm:divide-x">
          <Figure
            href="/clients"
            label="Clients"
            value={data.clients.total}
            hint={`+${data.clients.newThisMonth} ce mois`}
          />
          <Figure
            href="/tasks"
            label="Mes tâches"
            value={data.tasks.mine}
            hint={`${data.tasks.overdue} en retard au cabinet`}
          />
          <Figure
            href="/documents"
            label="Documents ce mois"
            value={data.documents.thisMonth}
          />
          <Figure
            href="/documents"
            label="Pièces qui expirent"
            value={data.documents.expiringSoon}
            hint="Dans les 30 jours"
            tone={data.documents.expiringSoon > 0 ? "warn" : undefined}
          />
        </dl>
      </Card>
    </div>
  );
}

/**
 * Chiffre de contexte : même information qu'une tuile, poids visuel moindre.
 * Réservé aux valeurs qui ne demandent pas d'action immédiate.
 */
function Figure({
  label,
  value,
  hint,
  href,
  tone,
}: {
  label: string;
  value: number;
  hint?: string;
  href: string;
  tone?: "warn";
}) {
  return (
    <Link
      href={href}
      className="block border-b border-line p-4 transition-colors last:border-b-0 hover:bg-surface2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent sm:border-b-0"
    >
      <dt className="text-xs font-medium uppercase tracking-wide text-muted">{label}</dt>
      <dd
        className={`mt-1 text-xl font-semibold tabular ${tone === "warn" ? "text-warn" : "text-ink"}`}
      >
        {value}
      </dd>
      {hint ? <p className="mt-0.5 text-xs text-muted">{hint}</p> : null}
    </Link>
  );
}
