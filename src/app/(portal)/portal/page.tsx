import { logoutAction } from "@/app/actions/auth";
import { requirePortal } from "@/lib/authz/guard";
import { formatDate, formatMad, relativeDays } from "@/lib/format";
import { Badge, Card, EmptyState, StatusPill } from "@/components/ui";
import { PortalUpload } from "./PortalUpload";

export const metadata = { title: "Mon espace — Daftar" };
export const dynamic = "force-dynamic";

/**
 * Portail client.
 *
 * Le contexte est restreint au seul dossier rattaché au compte : la portée est appliquée
 * dans le client Prisma, pas dans cette page. Les notes internes ne sont jamais chargées.
 */
export default async function PortalPage() {
  const ctx = await requirePortal();

  const [client, requests, deadlines, invoices, activities] = await Promise.all([
    ctx.db.client.findFirst({ where: { id: ctx.clientId } }),
    ctx.db.documentRequest.findMany({
      where: { status: { in: ["pending", "rejected", "submitted"] } },
      orderBy: { dueDate: "asc" },
    }),
    ctx.db.deadline.findMany({
      where: { status: { notIn: ["paid", "not_applicable"] } },
      orderBy: { dueDate: "asc" },
      take: 8,
    }),
    ctx.db.clientInvoice.findMany({
      where: { status: { in: ["pending", "partial", "overdue"] } },
      orderBy: { dueDate: "asc" },
    }),
    ctx.db.activity.findMany({
      where: { visibleToClient: true },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
  ]);

  const outstanding = invoices.reduce((sum, invoice) => sum + invoice.amount - invoice.paidAmount, 0);
  const todo = requests.filter((request) => request.status !== "submitted");

  return (
    <div className="min-h-screen bg-bg text-ink">
      <header className="border-b border-line bg-surface px-4 py-3 flex items-center gap-3">
        <div className="min-w-0">
          <div className="font-semibold truncate">{client?.legalName ?? "Mon espace"}</div>
          <div className="text-xs text-muted">Espace client · {ctx.cabinet.name}</div>
        </div>
        <div className="flex-1" />
        <form action={logoutAction}>
          <button type="submit" className="text-sm text-muted hover:text-ink px-2 py-1 rounded">
            Déconnexion
          </button>
        </form>
      </header>

      <main className="p-4 grid gap-4 max-w-3xl mx-auto">
        <Card title={`Pièces à fournir (${todo.length})`}>
          {todo.length === 0 ? (
            <EmptyState title="Rien à envoyer" description="Votre cabinet n'attend aucune pièce." />
          ) : (
            <ul className="grid gap-3">
              {todo.map((request) => (
                <li key={request.id} className="border border-line rounded-lg p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-medium text-sm">{request.title}</div>
                      <div className="text-xs text-muted">
                        {request.periodLabel ? `${request.periodLabel} · ` : ""}
                        {request.dueDate
                          ? `avant le ${formatDate(request.dueDate)} (${relativeDays(request.dueDate)})`
                          : "sans échéance"}
                      </div>
                      {request.description ? (
                        <p className="text-sm text-ink2 mt-1">{request.description}</p>
                      ) : null}
                      {request.status === "rejected" && request.rejectionReason ? (
                        <p className="text-sm text-danger mt-1">
                          À renvoyer : {request.rejectionReason}
                        </p>
                      ) : null}
                    </div>
                    <StatusPill status={request.status} />
                  </div>
                  <div className="mt-2">
                    <PortalUpload requestId={request.id} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="Vos échéances">
          {deadlines.length === 0 ? (
            <EmptyState title="Aucune échéance à venir" description="Rien n'est attendu pour l'instant." />
          ) : (
            <ul className="divide-y divide-line">
              {deadlines.map((deadline) => (
                <li key={deadline.id} className="py-2 flex items-center justify-between gap-3">
                  <div>
                    <div className="text-sm">{deadline.label}</div>
                    <div className="text-xs text-muted">
                      {formatDate(deadline.dueDate)} · {relativeDays(deadline.dueDate)}
                    </div>
                  </div>
                  <StatusPill status={deadline.status} />
                </li>
              ))}
            </ul>
          )}
        </Card>

        {outstanding > 0 ? (
          <Card title="Honoraires">
            <div className="text-xl font-medium tabular">{formatMad(outstanding)}</div>
            <ul className="mt-2 grid gap-1 text-sm text-ink2">
              {invoices.map((invoice) => (
                <li key={invoice.id} className="flex justify-between gap-3">
                  <span>
                    {invoice.reference} · échéance {formatDate(invoice.dueDate)}
                  </span>
                  <Badge tone={invoice.dueDate.getTime() < Date.now() ? "red" : "neutral"}>
                    {formatMad(invoice.amount - invoice.paidAmount)}
                  </Badge>
                </li>
              ))}
            </ul>
          </Card>
        ) : null}

        <Card title="Historique">
          {activities.length === 0 ? (
            <EmptyState title="Aucun échange" description="Vos échanges avec le cabinet apparaîtront ici." />
          ) : (
            <ol className="grid gap-2 text-sm">
              {activities.map((activity) => (
                <li key={activity.id} className="flex gap-3">
                  <span className="text-xs text-muted tabular w-20 shrink-0">
                    {formatDate(activity.createdAt)}
                  </span>
                  <span className="text-ink2">{activity.summary}</span>
                </li>
              ))}
            </ol>
          )}
        </Card>
      </main>
    </div>
  );
}
