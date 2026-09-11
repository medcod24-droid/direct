import Link from "next/link";
import { requireStaff } from "@/lib/authz/guard";
import { daysUntil, formatDate, formatMad, relativeDays } from "@/lib/format";
import { dayKey, endOf, MONTH_LABELS, wallTime } from "@/lib/calendar/month";
import { PRIORITY_LABELS, subtypeLabel } from "@/lib/domain/labels";
import { listAppointments } from "@/server/services/appointments";
import { listClientOptions } from "@/server/services/clients";
import {
  getCabinetDashboard,
  getClientsNeedingAttention,
  getMonthDeadlineSummary,
  getOverdueThisMonth,
  getUrgentTasks,
} from "@/server/services/dashboard";
import { getYearResults } from "@/server/services/finances";
import { listInterventionsBetween } from "@/server/services/interventions";
import { listStaffOptions } from "@/server/services/members";
import { listMyTodos, listTodos } from "@/server/services/todos";
import {
  Alert,
  Badge,
  Button,
  Card,
  CountBadge,
  EmptyState,
  Gauge,
  IconChip,
  MonthlyBars,
  PageHeader,
  ProgressBar,
  SegmentedProgress,
  StatTile,
} from "@/components/ui";
import { TodoCard } from "../todos/TodoCard";

export const metadata = { title: "Tableau de bord — Direct Conseil" };
export const dynamic = "force-dynamic";

/**
 * Tableau de bord.
 *
 * Il ouvre sur ce qu'il y a à faire aujourd'hui, dans cet ordre : le bandeau de
 * KPI, les échéances en retard du mois, la santé du cabinet, les rendez-vous du
 * jour, la to-do — la sienne puis celle de l'équipe —, et le résultat.
 *
 * Deux règles y sont tenues partout : aucun ensemble à plusieurs états ne
 * s'affiche sans son avancement, et aucun compteur sans son total — « 7 » ne dit
 * rien, « 7 sur 34 » oui.
 */
export default async function DashboardPage() {
  const ctx = await requireStaff("cabinet.view");

  // Journée en heures murales : les rendez-vous sont enregistrés tels qu'ils ont
  // été saisis, sans conversion de fuseau (voir lib/calendar/month.ts).
  const now = new Date();
  const dayStart = new Date(`${dayKey(now)}T00:00:00Z`);
  const dayEnd = new Date(dayStart.getTime() + 86_400_000);

  const [
    data,
    month,
    overdue,
    attention,
    urgentTasks,
    todayAppointments,
    myTodos,
    teamTodos,
    staff,
    todoClients,
    results,
    todayInterventions,
  ] = await Promise.all([
    getCabinetDashboard(ctx),
    getMonthDeadlineSummary(ctx, now),
    getOverdueThisMonth(ctx, now),
    getClientsNeedingAttention(ctx),
    ctx.can("task.view") ? getUrgentTasks(ctx) : Promise.resolve([]),
    ctx.can("appointment.view")
      ? listAppointments(ctx, { from: dayStart, to: dayEnd })
      : Promise.resolve([]),
    ctx.can("todo.view") ? listMyTodos(ctx) : Promise.resolve([]),
    // `listTodos` borne déjà la lecture : l'administration voit toute l'équipe,
    // un collaborateur seulement ce qui lui est confié.
    ctx.can("todo.manage") ? listTodos(ctx) : Promise.resolve([]),
    ctx.can("todo.manage") ? listStaffOptions(ctx) : Promise.resolve([]),
    ctx.can("todo.manage") ? listClientOptions(ctx) : Promise.resolve([]),
    ctx.can("finance.view") ? getYearResults(ctx, now.getUTCFullYear()) : Promise.resolve(null),
    // Même journée que les rendez-vous : la date d'un service est un jour, sans heure.
    ctx.can("intervention.view")
      ? listInterventionsBetween(ctx, dayStart, dayEnd)
      : Promise.resolve([]),
  ]);

  const canManageTodos = ctx.can("todo.manage");

  // La liste d'activité du jour se lit dossier par dossier : ce qu'on a fait pour
  // le client 1, puis pour le client 2, dans l'ordre où on l'a fait.
  const activityGroups: {
    client: { id: string; legalName: string };
    rows: typeof todayInterventions;
  }[] = [];
  for (const row of todayInterventions) {
    const group = activityGroups.find((entry) => entry.client.id === row.client.id);
    if (group) group.rows.push(row);
    else activityGroups.push({ client: row.client, rows: [row] });
  }
  const confirmed = teamTodos.filter((todo) => todo.status === "approved").length;

  // Regroupement par collaborateur : ce qui attend une confirmation remonte.
  const byAssignee = new Map<string, typeof teamTodos>();
  for (const todo of teamTodos) {
    if (todo.status === "approved") continue;
    const list = byAssignee.get(todo.assigneeId);
    if (list) list.push(todo);
    else byAssignee.set(todo.assigneeId, [todo]);
  }
  const groups = [...byAssignee.entries()]
    .map(([assigneeId, items]) => ({
      assigneeId,
      name: items[0]?.assigneeName ?? "—",
      items,
      submitted: items.filter((item) => item.status === "submitted").length,
      assigned: items.filter((item) => item.status !== "submitted").length,
      done: teamTodos.filter(
        (todo) => todo.assigneeId === assigneeId && todo.status === "approved",
      ).length,
    }))
    .sort((a, b) => b.submitted - a.submitted || a.name.localeCompare(b.name, "fr"));

  const honored = todayAppointments.filter((row) => row.status === "done").length;

  // Santé du cabinet : trois faits, pas un score opaque.
  const health = [
    { label: "Dépôts dans les délais", value: month.deposited, total: month.total },
    { label: "Dossiers actifs", value: data.clients.active, total: data.clients.total },
    // Les factures ne comptent que pour qui peut ouvrir les honoraires : pour un
    // assistant, la santé du cabinet se lit sur les dépôts et les dossiers.
    ...(ctx.can("invoice.view")
      ? [
          {
            label: "Factures sans retard",
            value: Math.max(0, data.invoices.count - data.invoices.overdueCount),
            total: data.invoices.count,
          },
        ]
      : []),
  ];
  const measured = health.filter((row) => row.total > 0);
  const healthRatio =
    measured.length > 0
      ? measured.reduce((sum, row) => sum + row.value / row.total, 0) / measured.length
      : 1;

  const trial =
    data.entitlements?.status === "trialing" && data.entitlements.trialEndsAt
      ? relativeDays(data.entitlements.trialEndsAt)
      : null;

  return (
    <div className="flex flex-col gap-[18px]">
      <PageHeader
        eyebrow={`Exercice ${now.getUTCFullYear()} · ${MONTH_LABELS[now.getUTCMonth()]}`}
        title={`Bonjour, ${ctx.user.name.split(" ")[0]}`}
        subtitle={`${data.clients.active} dossiers actifs · ${month.total} échéance(s) au titre du mois · ${month.overdue} en retard`}
        actions={
          ctx.can("client.create") ? (
            <Button href="/clients/new" variant="primary" iconName="plus">
              Nouveau dossier
            </Button>
          ) : undefined
        }
      />

      {trial ? (
        <Alert tone="info" title="Période d'essai">
          Période d&apos;essai du plan {data.entitlements?.planName} : elle se termine {trial}.{" "}
          <Link href="/settings" className="underline underline-offset-2">
            Voir les plans
          </Link>
        </Alert>
      ) : null}

      {data.warnings.map((warning) => (
        <Alert key={warning} tone="warning" title="Limite du plan">
          Limite bientôt atteinte — {warning}.
        </Alert>
      ))}

      {/* Bandeau de KPI : un fait par tuile, avec son total et sa comparaison. */}
      <section className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          label="En retard"
          icon="alert"
          value={month.overdue}
          over={`sur ${month.total} du mois`}
          tone={month.overdue > 0 ? "danger" : "success"}
          compare="Gérées par le cabinet, sans preuve de dépôt"
          href="/deadlines?status=overdue"
        />
        <StatTile
          label="Déposées"
          icon="check"
          value={month.deposited}
          over={`sur ${month.total} du mois`}
          tone="success"
          compare={`${month.remaining} encore à déposer`}
          href="/deadlines"
        />
        {/* Les honoraires sont une information financière : réservée à qui peut
            ouvrir la section Honoraires, comme la page vers laquelle la tuile mène. */}
        {ctx.can("invoice.view") ? (
          <StatTile
            label="Honoraires dus"
            icon="coins"
            value={formatMad(data.invoices.outstanding, { currency: false })}
            over="MAD"
            tone="gold"
            compare={`${data.invoices.count} facture(s) · ${data.invoices.overdueCount} en retard`}
            href="/invoices"
          />
        ) : null}
        <StatTile
          label="Rendez-vous"
          icon="clock"
          value={todayAppointments.length}
          over={`${honored} honoré(s) aujourd'hui`}
          tone="accent"
          compare={`${data.deadlines.today} échéance(s) tombent aujourd'hui`}
          href="/appointments"
        />
      </section>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,2.4fr)_minmax(0,1fr)] xl:items-start">
        {/* Échéances du mois : la progression d'abord, la liste ensuite. */}
        <Card
          icon="calendar"
          title="Échéances en retard ce mois-ci"
          description={`${month.deposited} déposées sur ${month.total} · ${month.overdue} en retard`}
          action={
            <Link
              href="/deadlines?status=overdue"
              className="text-sm text-accent underline underline-offset-2"
            >
              Toutes les échéances
            </Link>
          }
          padded={false}
        >
          <div className="px-4 pb-3.5">
            <SegmentedProgress
              height={10}
              total={month.total}
              segments={[
                { label: "Payées", value: month.paid, className: "bg-ok" },
                { label: "Déclarées", value: month.declared, className: "bg-accent" },
                { label: "À déposer", value: month.remaining, className: "bg-warn" },
                { label: "En retard", value: month.overdue, className: "bg-danger" },
              ]}
            />
          </div>

          {overdue.items.length === 0 ? (
            <EmptyState
              iconName="check"
              compact
              title="Rien en retard ce mois-ci"
              description="Les obligations du mois gérées par le cabinet sont à jour."
            />
          ) : (
            <div className="scroll-x">
              <table className="w-full min-w-[36rem] border-collapse">
                <thead>
                  <tr className="border-y border-line bg-surface2">
                    <th className="px-4 py-2.5 text-start text-2xs font-bold uppercase tracking-[0.09em] text-muted">
                      Client
                    </th>
                    <th className="px-3 py-2.5 text-start text-2xs font-bold uppercase tracking-[0.09em] text-muted">
                      Obligation
                    </th>
                    <th className="px-3 py-2.5 text-start text-2xs font-bold uppercase tracking-[0.09em] text-muted">
                      Période
                    </th>
                    <th className="px-3 py-2.5 text-start text-2xs font-bold uppercase tracking-[0.09em] text-muted">
                      Retard
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {overdue.items.map((deadline) => {
                    const late = Math.abs(daysUntil(deadline.dueDate) ?? 0);
                    return (
                      <tr key={deadline.id} className="border-b border-line last:border-b-0">
                        <td className="whitespace-nowrap px-4 py-3">
                          <Link
                            href={`/clients/${deadline.client.id}`}
                            className="text-sm font-semibold text-ink transition-colors hover:text-accent"
                          >
                            {deadline.client.legalName}
                          </Link>
                        </td>
                        <td className="whitespace-nowrap px-3 py-3 text-sm text-ink2">
                          {deadline.label}
                        </td>
                        <td className="whitespace-nowrap px-3 py-3 text-xs text-ink2 tabular">
                          {deadline.periodLabel}
                        </td>
                        <td className="px-3 py-3">
                          <div className="flex w-[112px] flex-col gap-1">
                            <span className="text-xs font-semibold text-danger tabular">
                              {formatDate(deadline.dueDate)} · {late} j
                            </span>
                            {/* Plus la barre est pleine, plus le retard est ancien.
                                Trente jours est le palier au-delà duquel une
                                pénalité devient probable. */}
                            <ProgressBar
                              value={Math.min(late, 30)}
                              total={30}
                              tone="danger"
                              label={`En retard de ${late} jour(s)`}
                            />
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {overdue.total > overdue.items.length ? (
            <p className="px-4 py-2.5 text-xs text-muted tabular">
              {overdue.total - overdue.items.length} autre(s) en retard ce mois-ci.
            </p>
          ) : null}
        </Card>

        <div className="flex flex-col gap-4">
          {/* Santé : la jauge donne le sentiment, les trois lignes le fondent. */}
          <Card icon="shield" iconTone="gold" title="Santé du cabinet">
            <div className="flex items-center gap-4">
              <Gauge
                ratio={healthRatio}
                caption={
                  healthRatio >= 0.85
                    ? "CONFORME"
                    : healthRatio >= 0.6
                      ? "À SURVEILLER"
                      : "CRITIQUE"
                }
                tone={healthRatio >= 0.85 ? "ok" : healthRatio >= 0.6 ? "gold" : "danger"}
                size={124}
              />
              <dl className="flex min-w-0 flex-col gap-2.5 text-xs">
                {health.map((row) => (
                  <div key={row.label} className="flex flex-col gap-0.5">
                    <dt className="text-muted">{row.label}</dt>
                    <dd className="font-650 text-ink tabular">
                      {row.total > 0 ? `${row.value} sur ${row.total}` : "—"}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          </Card>

          {ctx.can("appointment.view") ? (
            <Card
              icon="clock"
              title="Rendez-vous du jour"
              description={`${honored} honorés sur ${todayAppointments.length}`}
              action={
                <Link
                  href="/appointments"
                  className="text-sm text-accent underline underline-offset-2"
                >
                  Le calendrier
                </Link>
              }
              padded={false}
            >
              {todayAppointments.length === 0 ? (
                <EmptyState
                  iconName="calendar"
                  compact
                  title="Aucun rendez-vous aujourd'hui"
                  description="Le calendrier reste ouvert pour la suite du mois."
                />
              ) : (
                <ul className="border-t border-line">
                  {todayAppointments.map((appointment) => (
                    <li
                      key={appointment.id}
                      className="flex items-center gap-3 border-b border-line px-4 py-3 last:border-b-0"
                    >
                      <IconChip
                        name={
                          appointment.status === "done"
                            ? "check"
                            : appointment.status === "no_show"
                              ? "alert"
                              : "calendar"
                        }
                        tone={
                          appointment.status === "done"
                            ? "ok"
                            : appointment.status === "no_show"
                              ? "danger"
                              : "accent"
                        }
                        size={32}
                      />
                      <div className="flex min-w-0 flex-1 flex-col">
                        <Link
                          href={`/clients/${appointment.client.id}`}
                          className="truncate text-sm font-semibold text-ink transition-colors hover:text-accent"
                        >
                          {appointment.client.legalName}
                        </Link>
                        <span className="truncate text-xs text-muted">{appointment.title}</span>
                        {appointment.preparation ? (
                          <span className="truncate text-xs text-ink2">
                            À préparer : {appointment.preparation}
                          </span>
                        ) : null}
                      </div>
                      <span className="shrink-0 text-xs font-650 text-ink2 tabular">
                        {wallTime(appointment.startsAt)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          ) : null}
        </div>
      </div>

      {ctx.can("intervention.view") ? (
        <Card
          icon="folder"
          title="Liste d'activité du jour"
          description={
            todayInterventions.length === 0
              ? "Les services rendus aujourd'hui, tous dossiers confondus."
              : `${todayInterventions.length} service(s) rendu(s) aujourd'hui · ${activityGroups.length} dossier(s)`
          }
          padded={false}
        >
          {todayInterventions.length === 0 ? (
            <EmptyState
              iconName="folder"
              compact
              title="Aucun service enregistré aujourd'hui"
              description="Chaque service s'inscrit depuis la fiche du dossier, rubrique « Liste d'activité », et apparaît ici le jour même."
            />
          ) : (
            <ul className="grid border-t border-line lg:grid-cols-2">
              {activityGroups.map(({ client, rows }) => (
                <li
                  key={client.id}
                  className="border-b border-line px-4 py-3 lg:odd:border-e"
                >
                  <div className="flex items-center gap-2.5">
                    <IconChip name="folder" size={28} />
                    <Link
                      href={`/clients/${client.id}`}
                      className="min-w-0 flex-1 truncate text-sm font-semibold text-ink transition-colors hover:text-accent"
                    >
                      {client.legalName}
                    </Link>
                    <span className="shrink-0 text-xs text-muted tabular">
                      {rows.length} service{rows.length > 1 ? "s" : ""}
                    </span>
                  </div>
                  <ol className="mt-2 grid gap-2.5 ps-[38px]">
                    {rows.map((row) => (
                      <li key={row.id} className="grid gap-0.5">
                        <span className="text-sm font-550 text-ink">{row.service}</span>
                        {row.reason ? (
                          <span className="text-xs text-ink2">Motif : {row.reason}</span>
                        ) : null}
                        {row.report ? (
                          <span className="line-clamp-2 text-xs text-muted">
                            Compte rendu : {row.report}
                          </span>
                        ) : null}
                        {row.createdBy ? (
                          <span className="text-2xs text-muted">Par {row.createdBy.name}</span>
                        ) : null}
                      </li>
                    ))}
                  </ol>
                </li>
              ))}
            </ul>
          )}
        </Card>
      ) : null}

      {/* Ma to-do : ce que le cabinet attend de moi, quel que soit mon rôle. */}
      {myTodos.length > 0 ? (
        <Card
          icon="task"
          title="Ce que le cabinet attend de vous"
          description={`${myTodos.length} tâche(s) à rendre`}
          action={
            <Link href="/todos" className="text-sm text-accent underline underline-offset-2">
              Ma to-do
            </Link>
          }
          padded={false}
        >
          <ul className="border-t border-line">
            {myTodos.map((todo) => (
              <li
                key={todo.id}
                className="flex items-center gap-3 border-b border-line px-4 py-3 last:border-b-0"
              >
                <IconChip
                  name={todo.status === "returned" ? "alert" : "task"}
                  tone={todo.status === "returned" ? "danger" : "accent"}
                  size={32}
                />
                <div className="flex min-w-0 flex-1 flex-col">
                  <div className="flex flex-wrap items-center gap-2">
                    {todo.status === "returned" ? (
                      <Badge tone="red" iconName="alert">
                        Renvoyée
                      </Badge>
                    ) : null}
                    {todo.priority === "urgent" ? (
                      <Badge tone="red" iconName="alert">
                        {PRIORITY_LABELS.urgent}
                      </Badge>
                    ) : null}
                    <span className="text-sm font-semibold text-ink">{todo.title}</span>
                  </div>
                  {todo.reviewNote ? (
                    <span className="text-xs text-ink2">À reprendre : {todo.reviewNote}</span>
                  ) : null}
                </div>
                <div className="shrink-0 text-end text-xs">
                  {todo.dueDate ? (
                    <>
                      <div
                        className={
                          (daysUntil(todo.dueDate) ?? 0) < 0
                            ? "font-650 text-danger tabular"
                            : "text-ink2 tabular"
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

      <div className="grid gap-4 xl:grid-cols-[minmax(0,2.4fr)_minmax(0,1fr)] xl:items-start">
        {results ? (
          <Card
            icon="chart"
            iconTone="gold"
            title={`Résultat mensuel du cabinet — ${results.year}`}
            description={
              results.totals.monthsFilled === 0
                ? "Aucun mois saisi. Renseignez vos revenus et vos charges."
                : `${results.totals.monthsFilled} mois sur 12 renseignés · cumul ${formatMad(results.totals.result)}`
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

        {canManageTodos ? (
          <Card
            icon="team"
            title="To-do de l'équipe"
            description={`${confirmed} confirmées sur ${teamTodos.length}`}
            action={
              <Link href="/todos" className="text-sm text-accent underline underline-offset-2">
                Ouvrir la to-do
              </Link>
            }
            padded={false}
          >
            {groups.length === 0 ? (
              <EmptyState
                iconName="check"
                compact
                title="Rien en cours"
                description="Tout ce qui a été confié est confirmé."
              />
            ) : (
              <div className="border-t border-line">
                {groups.map((group) => (
                  <div
                    key={group.assigneeId}
                    className="border-b border-line px-4 py-3.5 last:border-b-0"
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-chip border border-line bg-surface2 text-[11px] font-bold text-ink2">
                        {initialsOf(group.name)}
                      </span>
                      <Link
                        href={`/team/${group.assigneeId}`}
                        className="min-w-0 flex-1 truncate text-sm font-semibold text-ink transition-colors hover:text-accent"
                      >
                        {group.name}
                      </Link>
                      {group.submitted > 0 ? (
                        <CountBadge value={group.submitted} tone="warn" />
                      ) : null}
                    </div>

                    <div className="mt-2">
                      <SegmentedProgress
                        segments={[
                          { label: "Confirmées", value: group.done, className: "bg-ok" },
                          { label: "Rendues", value: group.submitted, className: "bg-accent" },
                          { label: "À faire", value: group.assigned, className: "bg-warn" },
                        ]}
                      />
                    </div>

                    <div className="mt-2.5 grid gap-2">
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
      </div>

      {urgentTasks.length > 0 ? (
        <Card
          icon="check"
          iconTone="warn"
          title="À ne pas oublier"
          description={`${urgentTasks.length} tâche(s) urgentes, en retard, ou à faire sous 48 heures`}
          action={
            <Link
              href="/tasks?scope=team"
              className="text-sm text-accent underline underline-offset-2"
            >
              Toutes les tâches
            </Link>
          }
          padded={false}
        >
          <ul className="border-t border-line">
            {urgentTasks.map((task) => (
              <li
                key={task.id}
                className="flex items-center gap-3 border-b border-line px-4 py-3 last:border-b-0"
              >
                <IconChip
                  name={task.overdue ? "alert" : "check"}
                  tone={task.overdue ? "danger" : "warn"}
                  size={32}
                />
                <div className="flex min-w-0 flex-1 flex-col">
                  <div className="flex flex-wrap items-center gap-2">
                    {task.priority === "urgent" ? (
                      <Badge tone="red" iconName="alert">
                        {PRIORITY_LABELS.urgent}
                      </Badge>
                    ) : null}
                    <span className="text-sm font-semibold text-ink">{task.title}</span>
                  </div>
                  <span className="text-xs text-muted">
                    {task.client ? (
                      <Link
                        href={`/clients/${task.client.id}`}
                        className="transition-colors hover:text-accent"
                      >
                        {task.client.legalName}
                      </Link>
                    ) : (
                      "Tâche interne"
                    )}
                    {task.assignee ? ` · ${task.assignee.name}` : " · non assignée"}
                  </span>
                </div>
                <div className="shrink-0 text-end text-xs">
                  {task.dueDate ? (
                    <>
                      <div
                        className={
                          task.overdue ? "font-650 text-danger tabular" : "text-ink2 tabular"
                        }
                      >
                        {formatDate(task.dueDate)}
                      </div>
                      <div className={task.overdue ? "text-danger" : "text-muted"}>
                        {relativeDays(task.dueDate)}
                      </div>
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

      <div className="grid gap-4 xl:grid-cols-[minmax(0,2.4fr)_minmax(0,1fr)] xl:items-start">
        <Card
          icon="clients"
          title="Dossiers à surveiller"
          description={`${attention.length} dossier(s) avec des échéances en retard`}
          padded={false}
        >
          {attention.length === 0 ? (
            <EmptyState
              iconName="check"
              compact
              title="Aucun dossier en retard"
              description="Toutes les échéances gérées par le cabinet sont à jour."
            />
          ) : (
            <ul className="border-t border-line">
              {attention.map((row) => (
                <li
                  key={row.client.id}
                  className="flex items-center gap-3 border-b border-line px-4 py-3 last:border-b-0"
                >
                  <IconChip name="building" tone="neutral" size={32} />
                  <div className="flex min-w-0 flex-1 flex-col">
                    <Link
                      href={`/clients/${row.client.id}`}
                      className="truncate text-sm font-semibold text-ink transition-colors hover:text-accent"
                    >
                      {row.client.legalName}
                    </Link>
                    <span className="text-xs text-muted">
                      {subtypeLabel(row.client.subtype)}
                    </span>
                  </div>
                  <Badge tone="red" iconName="alert">
                    {row.overdue} en retard
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card
          icon="clock"
          iconTone="neutral"
          title="Journal du cabinet"
          description="Trace automatique des actions enregistrées"
          padded={false}
        >
          {data.activity.length === 0 ? (
            <EmptyState iconName="clock" compact title="Aucun événement" />
          ) : (
            <ol className="border-t border-line">
              {data.activity.slice(0, 8).map((item) => (
                <li key={item.id} className="border-b border-line px-4 py-2.5 last:border-b-0">
                  <p className="text-sm text-ink">{item.summary}</p>
                  <p className="text-xs text-muted">
                    {item.client ? `${item.client.legalName} · ` : ""}
                    {item.actorName ? `${item.actorName} · ` : ""}
                    {relativeDays(item.createdAt)}
                  </p>
                </li>
              ))}
            </ol>
          )}
        </Card>
      </div>

      <Card icon="dash" iconTone="neutral" title="Le cabinet en chiffres" padded={false}>
        <dl className="grid grid-cols-2 border-t border-line sm:grid-cols-4 sm:divide-x sm:divide-line">
          <Figure
            href="/clients"
            label="Clients"
            value={data.clients.total}
            hint={`${data.clients.newThisMonth} ce mois-ci`}
          />
          <Figure
            href="/tasks"
            label="Tâches ouvertes"
            value={data.tasks.open}
            hint={`${data.tasks.overdue} en retard`}
          />
          <Figure
            href="/documents"
            label="Documents ce mois"
            value={data.documents.thisMonth}
            hint={`${data.documents.expiringSoon} expirent bientôt`}
          />
          <Figure
            href="/requests"
            label="Pièces demandées"
            value={data.requests.pending}
            hint={`${data.requests.toReview} à examiner`}
          />
        </dl>
      </Card>
    </div>
  );
}

function Figure({
  href,
  label,
  value,
  hint,
}: {
  href: string;
  label: string;
  value: number;
  hint: string;
}) {
  return (
    <Link
      href={href}
      className="flex flex-col gap-0.5 px-4 py-3.5 transition-colors hover:bg-surface2"
    >
      <dt className="text-2xs font-bold uppercase tracking-[0.12em] text-muted">{label}</dt>
      <dd className="text-xl font-650 text-ink tabular">{value}</dd>
      <span className="text-xs text-muted tabular">{hint}</span>
    </Link>
  );
}

/** « Nawal Assistante » → « NA ». Deux lettres suffisent dans une puce de 28 px. */
function initialsOf(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word[0] ?? "")
    .slice(0, 2)
    .join("")
    .toUpperCase();
}
