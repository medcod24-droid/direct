import Link from "next/link";
import { requireStaff } from "@/lib/authz/guard";
import { formatDate, formatMad, relativeDays } from "@/lib/format";
import {
  clientFormLabel,
  effectiveDeadlineStatus,
  PROPERTY_USAGE_LABELS,
  TAX_REGIME_LABELS,
  VAT_REGIME_LABELS,
} from "@/lib/domain/labels";
import { getClientOverview, ratingsForClients } from "@/server/services/clients";
import { listClientAssignees, listMembers } from "@/server/services/members";
import { Alert, Badge, Button, Card, EmptyState, PageHeader, StarRating, StatusPill } from "@/components/ui";
import { ArchiveClient } from "./ArchiveClient";
import { Assignees } from "./Assignees";
import { RequestForm } from "./RequestForm";
import { UploadForm } from "./UploadForm";

export const dynamic = "force-dynamic";

export default async function ClientDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireStaff("client.view");
  const { id } = await params;
  const data = await getClientOverview(ctx, id);
  const { client } = data;

  // La fiche ne montre pas les mêmes pièces selon le type de personne : une
  // société n'a ni CIN ni immatriculation CNSS personnelle, un contribuable
  // individuel n'a ni certificat négatif ni associés.
  const individual = client.kind === "individual";
  const activities = jsonList<string>(client.declaredActivities);
  const partners = jsonList<{ role?: string; name?: string }>(client.partners);
  const referrer = data.referrer;
  const employees = jsonList<{ name?: string; cin?: string; cnssNo?: string }>(client.employees);
  const articles = jsonList<{
    number?: string;
    designation?: string;
    address?: string;
    usage?: string;
  }>(client.articles);
  const registrations = jsonList<{
    number?: string;
    court?: string;
    taxProfNos?: string[];
    branches?: { number?: string; court?: string; taxProfNos?: string[] }[];
  }>(client.registrations);

  // La note résume un comportement de paiement : c'est une information financière,
  // réservée à qui peut déjà voir les honoraires (report.view exclut l'assistant
  // et n'existe pas pour un compte client du portail).
  const rating = ctx.can("report.view") ? (await ratingsForClients(ctx, [id])).get(id) : undefined;

  // Les assignations conditionnent ce que voit un collaborateur restreint :
  // elles se gèrent donc depuis le dossier lui-même.
  const canAssign = ctx.can("client.assign");
  const [assignees, staff] = await Promise.all([
    listClientAssignees(ctx, id),
    canAssign ? listMembers(ctx) : Promise.resolve([]),
  ]);

  return (
    <div className="grid gap-5">
      <PageHeader
        title={client.legalName}
        subtitle={[client.tradeName, client.city, client.activity].filter(Boolean).join(" · ")}
        actions={
          <div className="flex items-center gap-3">
            {rating ? <StarRating stars={rating.stars} reasons={rating.reasons} /> : null}
            <StatusPill status={data.health.status} />
            <Button href={`/clients/${id}/fiche`} variant="ghost" size="sm">
              Imprimer la fiche
            </Button>
            {ctx.can("client.update") ? (
              <Button href={`/clients/${id}/edit`} variant="secondary" size="sm">
                Modifier
              </Button>
            ) : null}
            {ctx.can("client.delete") && client.status !== "archived" ? (
              <ArchiveClient clientId={id} legalName={client.legalName} />
            ) : null}
          </div>
        }
      />

      {data.health.status !== "green" ? (
        <Alert tone={data.health.status === "red" ? "danger" : "warning"}>
          {data.health.reasons.join(" · ")}
        </Alert>
      ) : null}

      <Card
        title="Collaborateurs du dossier"
        description="Qui suit ce dossier au cabinet."
      >
        <Assignees
          clientId={id}
          canAssign={canAssign}
          assignees={assignees}
          candidates={staff
            .filter((member) => member.role !== "client")
            .map((member) => ({ id: member.userId, label: `${member.name} — ${member.email}` }))}
        />
      </Card>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card title="Identité">
          <dl className="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-1.5 text-sm">
            <dt className="text-muted">Forme</dt>
            <dd>{clientFormLabel(client)}</dd>
            {individual && client.managerCin ? (
              <>
                <dt className="text-muted">CIN</dt>
                <dd className="tabular">{client.managerCin}</dd>
              </>
            ) : null}
            <dt className="text-muted">ICE</dt>
            <dd className="tabular">{client.ice ?? "—"}</dd>
            <dt className="text-muted">IF</dt>
            <dd className="tabular">{client.if ?? "—"}</dd>
            {individual ? (
              <>
                <dt className="text-muted">Délégation</dt>
                <dd>{client.taxDistrict ?? "—"}</dd>
              </>
            ) : (
              <>
                <dt className="text-muted">Certificat nég.</dt>
                <dd className="tabular">
                  {client.negCertNo ?? "—"}
                  {client.negCertExpiresAt ? ` — expire le ${formatDate(client.negCertExpiresAt)}` : ""}
                </dd>
              </>
            )}
            {client.authorizationNo ? (
              <>
                <dt className="text-muted">Autorisation</dt>
                <dd className="tabular">{client.authorizationNo}</dd>
              </>
            ) : null}
            {individual && client.cnssRegNo ? (
              <>
                <dt className="text-muted">CNSS (immat.)</dt>
                <dd className="tabular">{client.cnssRegNo}</dd>
              </>
            ) : null}
            <dt className="text-muted">CNSS (affil.)</dt>
            <dd className="tabular">
              {client.cnssNo ?? "—"}
              {typeof client.employeeCount === "number" ? ` — ${client.employeeCount} salarié(s)` : ""}
            </dd>
            <dt className="text-muted">Régime TVA</dt>
            <dd>{VAT_REGIME_LABELS[client.vatRegime] ?? client.vatRegime}</dd>
            <dt className="text-muted">Régime</dt>
            <dd>{TAX_REGIME_LABELS[client.taxRegime] ?? client.taxRegime}</dd>
            <dt className="text-muted">Clôture</dt>
            <dd className="tabular">
              {String(client.fiscalYearEndDay).padStart(2, "0")}/
              {String(client.fiscalYearEndMonth).padStart(2, "0")}
            </dd>
            <dt className="text-muted">Prise en charge</dt>
            <dd className="tabular">{formatDate(client.takeoverDate)}</dd>
            {referrer ? (
              <>
                <dt className="text-muted">Apporté par</dt>
                <dd>
                  <Link href={`/clients/${referrer.id}`} className="underline underline-offset-2">
                    {referrer.legalName}
                  </Link>
                </dd>
              </>
            ) : null}
            {individual ? (
              <>
                <dt className="text-muted">Adresse pers.</dt>
                <dd>{client.personalAddress ?? "—"}</dd>
              </>
            ) : null}
            <dt className="text-muted">{individual ? "Adresse prof." : "Siège"}</dt>
            <dd>
              {client.address ?? "—"}
              {!individual && client.isDomiciled ? " (domiciliation)" : ""}
            </dd>
            {activities.length > 0 ? (
              <>
                <dt className="text-muted">{individual ? "Activités" : "Objet social"}</dt>
                <dd>{activities.join(" · ")}</dd>
              </>
            ) : null}
            {articles.length > 0 ? (
              <>
                <dt className="text-muted">Articles</dt>
                <dd>
                  {articles
                    .map((article) =>
                      [
                        article.number,
                        article.designation,
                        article.usage ? PROPERTY_USAGE_LABELS[article.usage] : undefined,
                      ]
                        .filter(Boolean)
                        .join(" — "),
                    )
                    .join(" · ")}
                </dd>
              </>
            ) : null}
            {employees.length > 0 ? (
              <>
                <dt className="text-muted">Salariés</dt>
                <dd>
                  {employees
                    .map((employee) =>
                      [employee.name, employee.cnssNo].filter(Boolean).join(" — "),
                    )
                    .join(", ")}
                </dd>
              </>
            ) : null}
            {!individual && partners.length > 0 ? (
              <>
                <dt className="text-muted">Associés</dt>
                <dd>
                  {partners
                    .map((partner) =>
                      `${partner.name}${partner.role === "gerant" ? " (gérant)" : ""}`,
                    )
                    .join(", ")}
                </dd>
              </>
            ) : null}
          </dl>
        </Card>

        <Card title="Registre de commerce">
          {registrations.length === 0 ? (
            <p className="text-sm text-muted">
              {client.rc
                ? `${client.rc}${client.rcCourt ? ` (${client.rcCourt})` : ""}`
                : "Aucune immatriculation enregistrée."}
            </p>
          ) : (
            <ul className="grid gap-3 text-sm">
              {registrations.map((registration, index) => (
                <li key={`${registration.number}-${index}`} className="grid gap-1">
                  <div>
                    <span className="tabular">{registration.number}</span>
                    {registration.court ? (
                      <span className="text-muted"> — {registration.court}</span>
                    ) : null}
                    {index === 0 ? (
                      <span className="text-muted"> · principale</span>
                    ) : null}
                  </div>
                  {registration.taxProfNos?.length ? (
                    <div className="text-xs text-muted ps-3">
                      Taxe prof. : <span className="tabular">{registration.taxProfNos.join(", ")}</span>
                    </div>
                  ) : null}
                  {registration.branches?.map((branch, branchIndex) => (
                    <div key={`${branch.number}-${branchIndex}`} className="text-xs ps-3">
                      <span className="text-muted">Succursale </span>
                      <span className="tabular">{branch.number}</span>
                      {branch.court ? <span className="text-muted"> — {branch.court}</span> : null}
                      {branch.taxProfNos?.length ? (
                        <span className="text-muted">
                          {" "}
                          · taxe prof. <span className="tabular">{branch.taxProfNos.join(", ")}</span>
                        </span>
                      ) : null}
                    </div>
                  ))}
                </li>
              ))}
            </ul>
          )}
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

/** Colonne JSON illisible : la fiche s'affiche sans la liste plutôt qu'en erreur. */
function jsonList<T>(raw: unknown): T[] {
  if (typeof raw !== "string" || raw.length === 0) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
}
