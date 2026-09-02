import Link from "next/link";
import { requireStaff } from "@/lib/authz/guard";
import { formatMad, relativeDays } from "@/lib/format";
import { getCabinetDashboard, getClientsNeedingAttention } from "@/server/services/dashboard";
import { Alert, Card, EmptyState, PageHeader, StatTile } from "@/components/ui";

export const metadata = { title: "Tableau de bord — Direct Conseil" };
export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const ctx = await requireStaff("cabinet.view");
  const [data, attention] = await Promise.all([
    getCabinetDashboard(ctx),
    getClientsNeedingAttention(ctx),
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
        />
        <StatTile
          label="Échéances cette semaine"
          value={data.deadlines.week + data.deadlines.today}
          tone={data.deadlines.today > 0 ? "warning" : "neutral"}
          hint={`${data.deadlines.today} aujourd'hui`}
        />
        <StatTile
          label="Pièces à examiner"
          value={data.requests.toReview}
          hint={`${data.requests.pending} en attente chez les clients`}
        />
        <StatTile
          label="Honoraires impayés"
          value={formatMad(data.invoices.outstanding)}
          tone={data.invoices.overdueCount > 0 ? "warning" : "neutral"}
          hint={`${data.invoices.overdueCount} facture(s) en retard`}
        />
      </section>

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
                    {relativeDays(item.createdAt)}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </section>

      <section className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        <StatTile label="Clients" value={data.clients.total} hint={`+${data.clients.newThisMonth} ce mois`} />
        <StatTile label="Mes tâches" value={data.tasks.mine} hint={`${data.tasks.overdue} en retard au cabinet`} />
        <StatTile label="Documents ce mois" value={data.documents.thisMonth} />
        <StatTile
          label="Pièces qui expirent"
          value={data.documents.expiringSoon}
          hint="Dans les 30 jours"
          tone={data.documents.expiringSoon > 0 ? "warning" : "neutral"}
        />
      </section>
    </div>
  );
}
