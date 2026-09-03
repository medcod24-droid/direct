import Link from "next/link";
import { requireStaff } from "@/lib/authz/guard";
import { formatDate, formatMad, relativeDays } from "@/lib/format";
import { effectiveDeadlineStatus, subtypeLabel, VAT_REGIME_LABELS } from "@/lib/domain/labels";
import { getClientOverview, ratingsForClients } from "@/server/services/clients";
import { Alert, Badge, Card, EmptyState, PageHeader, StarRating, StatusPill } from "@/components/ui";
import { RequestForm } from "./RequestForm";
import { UploadForm } from "./UploadForm";

export const dynamic = "force-dynamic";

export default async function ClientDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireStaff("client.view");
  const { id } = await params;
  const data = await getClientOverview(ctx, id);
  const { client } = data;

  // La note résume un comportement de paiement : c'est une information financière,
  // réservée à qui peut déjà voir les honoraires (report.view exclut l'assistant
  // et n'existe pas pour un compte client du portail).
  const rating = ctx.can("report.view") ? (await ratingsForClients(ctx, [id])).get(id) : undefined;

  return (
    <div className="grid gap-5">
      <PageHeader
        title={client.legalName}
        subtitle={[client.tradeName, client.city, client.activity].filter(Boolean).join(" · ")}
        actions={
          <div className="flex items-center gap-3">
            {rating ? <StarRating stars={rating.stars} reasons={rating.reasons} /> : null}
            <StatusPill status={data.health.status} />
          </div>
        }
      />

      {data.health.status !== "green" ? (
        <Alert tone={data.health.status === "red" ? "danger" : "warning"}>
          {data.health.reasons.join(" · ")}
        </Alert>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-3">
        <Card title="Identité">
          <dl className="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-1.5 text-sm">
            <dt className="text-muted">Forme</dt>
            <dd>{subtypeLabel(client.subtype)}</dd>
            <dt className="text-muted">ICE</dt>
            <dd className="tabular">{client.ice ?? "—"}</dd>
            <dt className="text-muted">IF</dt>
            <dd className="tabular">{client.if ?? "—"}</dd>
            <dt className="text-muted">RC</dt>
            <dd className="tabular">
              {client.rc ?? "—"} {client.rcCourt ? `(${client.rcCourt})` : ""}
            </dd>
            <dt className="text-muted">Taxe prof.</dt>
            <dd className="tabular">{client.taxProfNo ?? "—"}</dd>
            <dt className="text-muted">CNSS</dt>
            <dd className="tabular">{client.cnssNo ?? "—"}</dd>
            <dt className="text-muted">Régime TVA</dt>
            <dd>{VAT_REGIME_LABELS[client.vatRegime] ?? client.vatRegime}</dd>
            <dt className="text-muted">Régime</dt>
            <dd className="uppercase">{client.taxRegime}</dd>
            <dt className="text-muted">Clôture</dt>
            <dd className="tabular">
              {String(client.fiscalYearEndDay).padStart(2, "0")}/
              {String(client.fiscalYearEndMonth).padStart(2, "0")}
            </dd>
            <dt className="text-muted">Prise en charge</dt>
            <dd className="tabular">{formatDate(client.takeoverDate)}</dd>
          </dl>
        </Card>

        <Card title="Échéances ouvertes" className="lg:col-span-2">
          {data.deadlines.length === 0 ? (
            <EmptyState
              title="Aucune échéance ouverte"
              description="Générez le calendrier depuis la page Échéances."
            />
          ) : (
            <ul className="divide-y divide-line">
              {data.deadlines.map((deadline) => (
                <li key={deadline.id} className="py-2 flex items-center justify-between gap-3">
                  <div>
                    <div className="text-sm">{deadline.label}</div>
                    <div className="text-xs text-muted">
                      {deadline.periodLabel} · échéance {formatDate(deadline.dueDate)} (
                      {relativeDays(deadline.dueDate)})
                      {deadline.managedBy !== "cabinet"
                        ? ` · géré par ${deadline.managedBy === "client" ? "le client" : "un tiers"}`
                        : ""}
                    </div>
                  </div>
                  <StatusPill status={effectiveDeadlineStatus(deadline)} />
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card
          title="Pièces demandées"
          action={ctx.can("request.create") ? <RequestForm clientId={client.id} /> : null}
        >
          {data.requests.length === 0 ? (
            <EmptyState title="Aucune demande en cours" description="Demandez une pièce au client." />
          ) : (
            <ul className="divide-y divide-line">
              {data.requests.map((request) => (
                <li key={request.id} className="py-2 flex items-center justify-between gap-3">
                  <div>
                    <div className="text-sm">{request.title}</div>
                    <div className="text-xs text-muted">
                      {request.periodLabel ? `${request.periodLabel} · ` : ""}
                      {request.dueDate ? `à fournir avant le ${formatDate(request.dueDate)}` : "sans échéance"}
                    </div>
                  </div>
                  <StatusPill status={request.status} />
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card
          title="Documents récents"
          action={ctx.can("document.upload") ? <UploadForm clientId={client.id} /> : null}
        >
          {data.documents.length === 0 ? (
            <EmptyState title="Aucun document" description="Déposez les pièces du dossier permanent." />
          ) : (
            <ul className="divide-y divide-line">
              {data.documents.map((document) => (
                <li key={document.id} className="py-2 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <a
                      href={`/api/documents/${document.id}/download`}
                      className="text-sm hover:underline underline-offset-2 truncate block"
                    >
                      {document.filename}
                    </a>
                    <div className="text-xs text-muted">
                      {document.category?.name ?? "Sans catégorie"} · {formatDate(document.createdAt)}
                      {document.expiresAt ? ` · expire le ${formatDate(document.expiresAt)}` : ""}
                    </div>
                  </div>
                  <Badge>{Math.round(document.size / 1024)} Ko</Badge>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card title="Honoraires">
          <div className="text-2xl font-medium tabular mb-1">{formatMad(data.outstanding)}</div>
          <p className="text-sm text-muted">
            {data.invoices.length} facture(s) ouverte(s) · {data.overdueInvoices} en retard
          </p>
          {client.feeAmount ? (
            <p className="text-sm text-ink2 mt-2">
              Abonnement : {formatMad(client.feeAmount)} / {client.feeFrequency ?? "mois"}
            </p>
          ) : null}
        </Card>

        <Card title="Contacts" className="lg:col-span-2">
          {data.contacts.length === 0 ? (
            <EmptyState title="Aucun contact" description="Ajoutez les interlocuteurs du dossier." />
          ) : (
            <ul className="grid gap-2">
              {data.contacts.map((contact) => (
                <li key={contact.id} className="text-sm">
                  <span className="font-medium">{contact.name}</span>
                  {contact.position ? <span className="text-muted"> · {contact.position}</span> : null}
                  <div className="text-xs text-muted">
                    {[contact.phone, contact.email].filter(Boolean).join(" · ") || "—"}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <Card title="Historique">
        {data.activities.length === 0 ? (
          <EmptyState title="Aucune activité" description="Les événements du dossier apparaîtront ici." />
        ) : (
          <ol className="grid gap-2">
            {data.activities.map((activity) => (
              <li key={activity.id} className="text-sm flex gap-3">
                <span className="text-xs text-muted tabular w-24 shrink-0">
                  {formatDate(activity.createdAt)}
                </span>
                <span className="text-ink2">{activity.summary}</span>
              </li>
            ))}
          </ol>
        )}
      </Card>

      <p className="text-xs text-muted">
        <Link href="/clients" className="underline underline-offset-2">
          Retour à la liste
        </Link>
      </p>
    </div>
  );
}
