import Link from "next/link";
import { requireStaff } from "@/lib/authz/guard";
import { formatDate, formatMad, relativeDays } from "@/lib/format";
import { PRIORITY_LABELS } from "@/lib/domain/labels";
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
  const [data, attention, urgentTasks] = await Promise.all([
    getCabinetDashboard(ctx),
    getClientsNeedingAttention(ctx),
    ctx.can("task.view") ? getUrgentTasks(ctx) : Promise.resolve([]),
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
