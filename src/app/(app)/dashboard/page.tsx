import Link from "next/link";
import { requireStaff } from "@/lib/authz/guard";
import { formatDate, formatMad, relativeDays } from "@/lib/format";
import { PRIORITY_LABELS } from "@/lib/domain/labels";
import { dayKey, endOf, wallTime } from "@/lib/calendar/month";
import { listAppointments } from "@/server/services/appointments";
import { listAwaitingApproval, listMyTodos } from "@/server/services/todos";
import {
  getCabinetDashboard,
  getClientsNeedingAttention,
  getUrgentTasks,
} from "@/server/services/dashboard";
import { Alert, Badge, Card, EmptyState, PageHeader, StatTile } from "@/components/ui";

export const metadata = { title: "Tableau de bord — Direct Conseil" };
export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const ctx = await requireStaff("cabinet.view");
  // Journée en heures murales : les rendez-vous sont enregistrés tels qu'ils ont
  // été saisis, sans conversion de fuseau (voir lib/calendar/month.ts).
  const now = new Date();
  const dayStart = new Date(`${dayKey(now)}T00:00:00Z`);
  const dayEnd = new Date(dayStart.getTime() + 86_400_000);

  const [data, attention, urgentTasks, todayAppointments, myTodos, todosToApprove] =
    await Promise.all([
      getCabinetDashboard(ctx),
      getClientsNeedingAttention(ctx),
      ctx.can("task.view") ? getUrgentTasks(ctx) : Promise.resolve([]),
      ctx.can("appointment.view")
        ? listAppointments(ctx, { from: dayStart, to: dayEnd })
        : Promise.resolve([]),
      ctx.can("todo.view") ? listMyTodos(ctx) : Promise.resolve([]),
      listAwaitingApproval(ctx),
    ]);

  const trial =
    data.entitlements?.status === "trialing" && data.entitlements.trialEndsAt
      ? relativeDays(data.entitlements.trialEndsAt)
      : null;

  return (
    <div className="grid gap-6">
      <PageHeader
        title={`Bonjour, ${ctx.user.name.split(" ")[0]}`}
        subtitle={`${data.clients.active} dossiers actifs · ${data.deadlines.overdue} échéance(s) en retard`}
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

      <section className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        <StatTile
          label="Échéances en retard"
          value={data.deadlines.overdue}
          tone={data.deadlines.overdue > 0 ? "danger" : "success"}
          hint="Gérées par le cabinet, sans preuve de dépôt"
          href="/deadlines?status=overdue"
        />
        <StatTile
          label="Échéances cette semaine"
          value={data.deadlines.week + data.deadlines.today}
          tone={data.deadlines.today > 0 ? "warning" : "neutral"}
          hint={`${data.deadlines.today} aujourd'hui`}
          href="/deadlines"
        />
        <StatTile
          label="Pièces à examiner"
          value={data.requests.toReview}
          hint={`${data.requests.pending} en attente chez les clients`}
          href="/requests"
        />
        <StatTile
          label="Honoraires impayés"
          value={formatMad(data.invoices.outstanding)}
          tone={data.invoices.overdueCount > 0 ? "warning" : "neutral"}
          hint={`${data.invoices.overdueCount} facture(s) en retard`}
          href="/invoices"
        />
      </section>

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
                          todo.dueDate.getTime() < Date.now()
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

      {todosToApprove.length > 0 ? (
        <Card
          title="Tâches rendues, à confirmer"
          description="L'équipe a terminé et laissé une note. Lisez-la avant de confirmer."
          action={
            <Link href="/todos" className="text-sm text-accent underline underline-offset-2">
              Ouvrir la to-do
            </Link>
          }
        >
          <ul className="divide-y divide-line">
            {todosToApprove.map((todo) => (
              <li key={todo.id} className="py-2.5">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone="amber">À confirmer</Badge>
                  <span className="text-sm">{todo.title}</span>
                  <span className="text-xs text-muted">— {todo.assigneeName}</span>
                </div>
                {todo.submittedNote ? (
                  <p className="mt-0.5 whitespace-pre-line text-xs text-ink2">
                    {todo.submittedNote}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      {todayAppointments.length > 0 ? (
        <Card
          title="Rendez-vous du jour"
          description="Qui vient aujourd'hui, et ce qu'il faut avoir sorti."
          action={
            <Link href="/appointments" className="text-sm text-accent underline underline-offset-2">
              Le calendrier
            </Link>
          }
        >
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
