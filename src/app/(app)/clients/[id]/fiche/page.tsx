import Link from "next/link";
import { requireStaff } from "@/lib/authz/guard";
import {
  clientFormLabel,
  PROPERTY_USAGE_LABELS,
  TAX_REGIME_LABELS,
  VAT_REGIME_LABELS,
} from "@/lib/domain/labels";
import { formatDate, formatMad } from "@/lib/format";
import { getClientOverview } from "@/server/services/clients";
import { listInterventions } from "@/server/services/interventions";
import { Button } from "@/components/ui";
import { PrintButton } from "./PrintButton";

export const metadata = { title: "Fiche client — Direct Conseil" };
export const dynamic = "force-dynamic";

type Row = [label: string, value: string | null | undefined];

/** Ne garde que les lignes renseignées : une fiche imprimée n'aligne pas des tirets. */
function filled(rows: Row[]): [string, string][] {
  return rows.filter((row): row is [string, string] => Boolean(row[1] && String(row[1]).trim()));
}

function parse<T>(raw: unknown): T[] {
  if (typeof raw !== "string" || raw.length === 0) return [];
  try {
    const value: unknown = JSON.parse(raw);
    return Array.isArray(value) ? (value as T[]) : [];
  } catch {
    return [];
  }
}

const date = (value: unknown) => (value instanceof Date ? formatDate(value) : "");

/**
 * Fiche client imprimable.
 *
 * Destinée au dossier papier du cabinet : le comptable l'imprime et la colle en
 * tête du classeur du client. Elle n'affiche donc que les informations
 * effectivement saisies — un formulaire imprimé plein de tirets ne se relit
 * pas — et rien qui ne serve à la retrouver ou à la contrôler.
 *
 * La mise en page est celle d'un document, pas d'un écran : fond blanc, encre
 * noire, sections qui ne se coupent pas entre deux pages. Le reste de
 * l'interface disparaît à l'impression (voir `globals.css`).
 */
export default async function ClientFichePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const ctx = await requireStaff("client.view");
  const { id } = await params;
  const [{ client, contacts, referrer }, interventions] = await Promise.all([
    getClientOverview(ctx, id),
    ctx.can("intervention.view") ? listInterventions(ctx, id) : Promise.resolve([]),
  ]);

  const individual = client.kind === "individual";
  const activities = parse<string>(client.declaredActivities);
  const partners = parse<{ role?: string; name?: string; cin?: string; phone?: string; address?: string }>(
    client.partners,
  );
  const employees = parse<{ name?: string; cin?: string; cnssNo?: string }>(client.employees);
  const articles = parse<{
    number?: string;
    designation?: string;
    address?: string;
    usage?: string;
  }>(client.articles);
  const registrations = parse<{
    number?: string;
    court?: string;
    taxProfNos?: { value?: string }[];
    branches?: { number?: string; court?: string; taxProfNos?: { value?: string }[] }[];
  }>(client.registrations);

  const identity = filled([
    ["Forme juridique", clientFormLabel(client)],
    [individual ? "CIN" : "CIN du gérant", client.managerCin],
    ["Identifiant fiscal", client.if],
    ["ICE", client.ice],
    ["Délégation", client.taxDistrict],
    ["N° d'autorisation", client.authorizationNo],
    ["Nom commercial", client.tradeName],
    ["N° d'enseigne", client.signNo],
    ["Enseigne — date de référence", date(client.signRefDate)],
    ["Enseigne — expiration", date(client.signExpiresAt)],
    ["Certificat négatif", client.negCertNo],
    ["Certificat négatif — date", date(client.negCertDate)],
    ["Certificat négatif — expiration", date(client.negCertExpiresAt)],
  ]);

  const addresses = filled([
    ["Adresse personnelle", client.personalAddress],
    [individual ? "Adresse professionnelle" : "Siège social", client.address],
    ["Domiciliation", !individual && client.isDomiciled ? "Oui" : ""],
    ["Ville", client.city],
    ["Téléphone", client.phone],
    ["E-mail", client.email],
    ["Site web", client.website],
  ]);

  const regime = filled([
    ["Régime fiscal", TAX_REGIME_LABELS[client.taxRegime] ?? client.taxRegime],
    ["Régime de TVA", VAT_REGIME_LABELS[client.vatRegime] ?? client.vatRegime],
    [
      "Clôture de l'exercice",
      `${String(client.fiscalYearEndDay).padStart(2, "0")}/${String(client.fiscalYearEndMonth).padStart(2, "0")}`,
    ],
    ["Début d'activité", date(client.startedAt)],
    ["Prise en charge par le cabinet", date(client.takeoverDate)],
    ["Employeur", client.isEmployer ? "Oui" : ""],
    [
      "Honoraires",
      typeof client.feeAmount === "number" ? `${formatMad(client.feeAmount)} HT` : "",
    ],
    ["Apporté par", referrer?.legalName],
  ]);

  const cnss = filled([
    ["Immatriculation", client.cnssRegNo],
    ["N° d'affiliation", client.cnssNo],
    ["Date d'affiliation", date(client.cnssAffiliatedAt)],
    ["Nombre de salariés", client.employeeCount ? String(client.employeeCount) : ""],
  ]);

  return (
    <div className="mx-auto max-w-3xl">
      <div className="no-print mb-4 flex items-center justify-between gap-3">
        <Button href={`/clients/${id}`} variant="ghost" size="sm">
          Retour au dossier
        </Button>
        <PrintButton />
      </div>

      <article className="rounded-card border border-line bg-surface p-8 text-ink shadow-edge print:border-0 print:bg-white print:p-0 print:text-black print:shadow-none">
        <header className="print-bloc flex items-baseline justify-between gap-4 border-b border-line pb-3">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted print:text-black">
              {ctx.cabinet.name}
            </p>
            <h1 className="mt-1 text-xl font-semibold">{client.legalName}</h1>
            <p className="text-sm text-muted print:text-black">
              {[clientFormLabel(client), client.tradeName, client.city]
                .filter(Boolean)
                .join(" · ")}
            </p>
          </div>
          <p className="shrink-0 text-xs text-muted print:text-black">
            Fiche éditée le {formatDate(new Date())}
          </p>
        </header>

        <Section title="Identité" rows={identity} />
        {activities.length > 0 ? (
          <Section
            title={individual ? "Activités" : "Objet social"}
            rows={[[individual ? "Déclarées" : "Déclaré", activities.join(" · ")]]}
          />
        ) : null}
        <Section title="Adresses et contact" rows={addresses} />

        {registrations.length > 0 ? (
          <section className="print-bloc mt-5">
            <h2 className="text-sm font-semibold uppercase tracking-wide">Registre de commerce</h2>
            <ul className="mt-2 grid gap-2 text-sm">
              {registrations.map((registration, index) => (
                <li key={`${registration.number}-${index}`}>
                  <div>
                    <span className="font-medium tabular">{registration.number}</span>
                    {registration.court ? <span> — {registration.court}</span> : null}
                    {index === 0 ? (
                      <span className="text-muted print:text-black"> (principale)</span>
                    ) : null}
                  </div>
                  {registration.taxProfNos?.length ? (
                    <div className="ps-4 text-[13px]">
                      Taxe professionnelle :{" "}
                      <span className="tabular">
                        {registration.taxProfNos.map((tax) => tax.value).filter(Boolean).join(", ")}
                      </span>
                    </div>
                  ) : null}
                  {registration.branches?.map((branch, branchIndex) => (
                    <div key={`${branch.number}-${branchIndex}`} className="ps-4 text-[13px]">
                      Succursale <span className="tabular">{branch.number}</span>
                      {branch.court ? <span> — {branch.court}</span> : null}
                      {branch.taxProfNos?.length ? (
                        <span>
                          {" "}
                          · taxe prof.{" "}
                          <span className="tabular">
                            {branch.taxProfNos.map((tax) => tax.value).filter(Boolean).join(", ")}
                          </span>
                        </span>
                      ) : null}
                    </div>
                  ))}
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <Section title="Régime et échéances" rows={regime} />
        <Section title="CNSS" rows={cnss} />

        {partners.length > 0 ? (
          <Listing
            title="Direction et associés"
            head={["Qualité", "Nom", "CIN", "Téléphone", "Adresse"]}
            rows={partners.map((partner) => [
              partner.role === "gerant" ? "Gérant" : "Associé",
              partner.name ?? "",
              partner.cin ?? "",
              partner.phone ?? "",
              partner.address ?? "",
            ])}
          />
        ) : null}

        {articles.length > 0 ? (
          <Listing
            title="Articles d'imposition"
            head={["N° d'article", "Désignation", "Adresse", "Usage"]}
            rows={articles.map((article) => [
              article.number ?? "",
              article.designation ?? "",
              article.address ?? "",
              article.usage ? PROPERTY_USAGE_LABELS[article.usage] ?? article.usage : "",
            ])}
          />
        ) : null}

        {employees.length > 0 ? (
          <Listing
            title="Salariés déclarés"
            head={["Nom", "CIN", "N° CNSS"]}
            rows={employees.map((employee) => [
              employee.name ?? "",
              employee.cin ?? "",
              employee.cnssNo ?? "",
            ])}
          />
        ) : null}

        {contacts.length > 0 ? (
          <Listing
            title="Contacts"
            head={["Nom", "Fonction", "Téléphone", "E-mail"]}
            rows={contacts.map((contact) => [
              contact.name,
              contact.position ?? "",
              contact.phone ?? "",
              contact.email ?? "",
            ])}
          />
        ) : null}

        {interventions.length > 0 ? (
          <section className="print-bloc mt-5">
            <h2 className="text-sm font-semibold uppercase tracking-wide">Liste d&apos;activité</h2>
            <table className="mt-2 w-full text-sm">
              <thead>
                <tr className="border-b border-line">
                  <th className="py-1 text-start font-medium text-muted print:text-black">Service</th>
                  <th className="py-1 text-start font-medium text-muted print:text-black">Date</th>
                  <th className="py-1 text-start font-medium text-muted print:text-black">Motif</th>
                  <th className="py-1 text-start font-medium text-muted print:text-black">
                    Compte rendu
                  </th>
                </tr>
              </thead>
              <tbody>
                {interventions.map((row) => (
                  <tr key={row.id} className="border-b border-line/60">
                    <td className="py-1 pe-3 align-top">{row.service}</td>
                    <td className="py-1 pe-3 align-top tabular whitespace-nowrap">
                      {formatDate(row.performedAt)}
                    </td>
                    <td className="py-1 pe-3 align-top">{row.reason ?? ""}</td>
                    <td className="py-1 align-top whitespace-pre-line">{row.report ?? ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        ) : null}

        {client.notes ? (
          <section className="print-bloc mt-5">
            <h2 className="text-sm font-semibold uppercase tracking-wide">Notes</h2>
            <p className="mt-2 whitespace-pre-line text-sm">{client.notes}</p>
          </section>
        ) : null}

        <footer className="mt-8 border-t border-line pt-2 text-[11px] text-muted print:text-black">
          Direct Conseil · {ctx.cabinet.name} · document interne au cabinet, contenant des
          données personnelles (loi 09-08).
        </footer>
      </article>

      <p className="no-print mt-3 text-xs text-muted">
        Seules les informations saisies apparaissent. Complétez la fiche depuis{" "}
        <Link href={`/clients/${id}/edit`} className="underline">
          Modifier le dossier
        </Link>
        .
      </p>
    </div>
  );
}

function Section({ title, rows }: { title: string; rows: [string, string][] }) {
  if (rows.length === 0) return null;
  return (
    <section className="print-bloc mt-5">
      <h2 className="text-sm font-semibold uppercase tracking-wide">{title}</h2>
      <dl className="mt-2 grid grid-cols-[minmax(0,14rem)_1fr] gap-x-4 gap-y-1 text-sm">
        {rows.map(([label, value]) => (
          <div key={label} className="contents">
            <dt className="text-muted print:text-black">{label}</dt>
            <dd className="tabular">{value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function Listing({
  title,
  head,
  rows,
}: {
  title: string;
  head: string[];
  rows: string[][];
}) {
  // Une colonne entièrement vide est retirée : sans CIN enregistrée, la fiche
  // imprimée n'a pas à réserver une colonne blanche.
  const keep = head.map((_, index) => rows.some((row) => row[index]?.trim()));

  return (
    <section className="print-bloc mt-5">
      <h2 className="text-sm font-semibold uppercase tracking-wide">{title}</h2>
      <table className="mt-2 w-full text-sm">
        <thead>
          <tr className="border-b border-line text-start">
            {head.map((label, index) =>
              keep[index] ? (
                <th key={label} className="py-1 text-start font-medium text-muted print:text-black">
                  {label}
                </th>
              ) : null,
            )}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr key={rowIndex} className="border-b border-line/60">
              {row.map((cell, index) =>
                keep[index] ? (
                  <td key={index} className="py-1 pe-3 align-top">
                    {cell}
                  </td>
                ) : null,
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
