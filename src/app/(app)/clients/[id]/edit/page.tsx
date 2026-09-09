import { requireStaff } from "@/lib/authz/guard";
import { getClientOverview } from "@/server/services/clients";
import { PageHeader } from "@/components/ui";
import { EditClientForm } from "./EditClientForm";

export const metadata = { title: "Modifier le dossier — Direct Conseil" };
export const dynamic = "force-dynamic";

/**
 * Valeurs du dossier au format attendu par les champs du formulaire.
 *
 * Les groupes répétables sont aplatis en `nom.index.champ`, plus un `nom.count` :
 * `ClientFields` ne reçoit qu'une fonction de lecture par nom de champ, la même
 * qu'après un refus du serveur. Un seul format à gérer des deux côtés.
 */
function toFormValues(client: Record<string, unknown>): Record<string, string> {
  const text = (v: unknown) => (v === null || v === undefined ? "" : String(v));
  const date = (v: unknown) => (v instanceof Date ? v.toISOString().slice(0, 10) : "");

  const values: Record<string, string> = {
    kind: text(client.kind),
    subtype: text(client.subtype),
    legalName: text(client.legalName),
    tradeName: text(client.tradeName),
    ice: text(client.ice),
    if: text(client.if),
    rc: text(client.rc),
    rcCourt: text(client.rcCourt),
    cnssNo: text(client.cnssNo),
    managerCin: text(client.managerCin),
    address: text(client.address),
    city: text(client.city),
    phone: text(client.phone),
    email: text(client.email),
    website: text(client.website),
    taxRegime: text(client.taxRegime),
    vatRegime: text(client.vatRegime),
    fiscalYearEndMonth: text(client.fiscalYearEndMonth),
    fiscalYearEndDay: text(client.fiscalYearEndDay),
    takeoverDate: date(client.takeoverDate),
    isEmployer: client.isEmployer ? "on" : "",

    authorizationNo: text(client.authorizationNo),
    employeeCount: text(client.employeeCount),
    startedAt: date(client.startedAt),

    taxDistrict: text(client.taxDistrict),
    signNo: text(client.signNo),
    signRefDate: date(client.signRefDate),
    signExpiresAt: date(client.signExpiresAt),
    personalAddress: text(client.personalAddress),
    cnssRegNo: text(client.cnssRegNo),
    cnssAffiliatedAt: date(client.cnssAffiliatedAt),

    negCertNo: text(client.negCertNo),
    negCertDate: date(client.negCertDate),
    negCertExpiresAt: date(client.negCertExpiresAt),
    isDomiciled: client.isDomiciled ? "on" : "",

    // Les montants sont stockés en centimes ; le formulaire travaille en dirhams.
    feeAmount:
      typeof client.feeAmount === "number" ? String(client.feeAmount / 100) : "",
    feeFrequency: text(client.feeFrequency) || "monthly",
  };

  // Repli sur la colonne courte pour les dossiers antérieurs aux listes : sans
  // lui, leur fiche s'ouvrirait avec zéro ligne et le premier enregistrement
  // effacerait l'activité déjà saisie, sans que rien ne le signale.
  flatten(values, "activities", withFallback(client.declaredActivities, client.activity));
  flatten(values, "partners", parseList(client.partners));
  flatten(values, "employees", parseList(client.employees));
  flattenRegistrations(values, client);

  return values;
}

/**
 * Aplatit l'arbre des immatriculations selon la même convention que le
 * formulaire, compteur par niveau compris.
 *
 * Repli sur `rc` / `rcCourt` / `taxProfNo` pour les dossiers saisis avant
 * l'arborescence : sans lui, leur fiche s'ouvrirait sans aucune immatriculation
 * et le premier enregistrement effacerait le numéro déjà saisi.
 */
function flattenRegistrations(values: Record<string, string>, client: Record<string, unknown>) {
  let registrations = parseList(client.registrations);
  if (registrations.length === 0 && client.rc) {
    registrations = [
      {
        number: client.rc,
        court: client.rcCourt,
        taxProfNos: client.taxProfNo ? [client.taxProfNo] : [],
        branches: [],
      },
    ];
  }

  values["registrations.count"] = String(registrations.length);
  registrations.forEach((registration, index) => {
    const prefix = `registrations.${index}`;
    values[`${prefix}.number`] = String(registration.number ?? "");
    values[`${prefix}.court`] = String(registration.court ?? "");
    flattenTaxes(values, prefix, registration.taxProfNos);

    const branches = Array.isArray(registration.branches) ? registration.branches : [];
    values[`${prefix}.branches.count`] = String(branches.length);
    branches.forEach((branch: Record<string, unknown>, branchIndex: number) => {
      const branchPrefix = `${prefix}.branches.${branchIndex}`;
      values[`${branchPrefix}.number`] = String(branch.number ?? "");
      values[`${branchPrefix}.court`] = String(branch.court ?? "");
      flattenTaxes(values, branchPrefix, branch.taxProfNos);
    });
  });
}

function flattenTaxes(values: Record<string, string>, prefix: string, raw: unknown) {
  const taxes = Array.isArray(raw) ? raw : [];
  values[`${prefix}.taxProfNos.count`] = String(taxes.length);
  taxes.forEach((tax, index) => {
    values[`${prefix}.taxProfNos.${index}.value`] = String(tax ?? "");
  });
}

function withFallback(raw: unknown, legacy: unknown): { value: unknown }[] {
  const items = parseList(raw).map((item) => ({ value: item.value }));
  if (items.length > 0) return items;
  return legacy ? [{ value: legacy }] : [];
}

/** Colonne JSON illisible : la fiche s'ouvre sur une liste vide plutôt que sur une erreur. */
function parseList(raw: unknown): Record<string, unknown>[] {
  if (typeof raw !== "string" || raw.length === 0) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map((item) =>
      item !== null && typeof item === "object" ? (item as Record<string, unknown>) : { value: item },
    );
  } catch {
    return [];
  }
}

function flatten(
  values: Record<string, string>,
  name: string,
  items: Record<string, unknown>[],
) {
  values[`${name}.count`] = String(items.length);
  items.forEach((item, index) => {
    for (const [key, value] of Object.entries(item)) {
      if (value === null || value === undefined) continue;
      values[`${name}.${index}.${key}`] = String(value);
    }
  });
}

export default async function EditClientPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const ctx = await requireStaff("client.update");
  const { id } = await params;
  const { client } = await getClientOverview(ctx, id);

  return (
    <div className="grid gap-5">
      <PageHeader
        title="Modifier le dossier"
        subtitle={client.legalName}
      />
      <EditClientForm
        clientId={id}
        cndpMode={ctx.cabinet.cndpMode}
        current={toFormValues(client as unknown as Record<string, unknown>)}
      />
    </div>
  );
}
