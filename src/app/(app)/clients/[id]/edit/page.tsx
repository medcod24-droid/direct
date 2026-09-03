import { requireStaff } from "@/lib/authz/guard";
import { getClientOverview } from "@/server/services/clients";
import { PageHeader } from "@/components/ui";
import { EditClientForm } from "./EditClientForm";

export const metadata = { title: "Modifier le dossier — Direct Conseil" };
export const dynamic = "force-dynamic";

/** Valeurs du dossier au format attendu par les champs du formulaire. */
function toFormValues(client: Record<string, unknown>): Record<string, string> {
  const text = (v: unknown) => (v === null || v === undefined ? "" : String(v));
  const date = (v: unknown) =>
    v instanceof Date ? v.toISOString().slice(0, 10) : "";

  return {
    kind: text(client.kind),
    subtype: text(client.subtype),
    legalName: text(client.legalName),
    tradeName: text(client.tradeName),
    ice: text(client.ice),
    if: text(client.if),
    rc: text(client.rc),
    city: text(client.city),
    phone: text(client.phone),
    email: text(client.email),
    activity: text(client.activity),
    taxRegime: text(client.taxRegime),
    vatRegime: text(client.vatRegime),
    fiscalYearEndMonth: text(client.fiscalYearEndMonth),
    fiscalYearEndDay: text(client.fiscalYearEndDay),
    takeoverDate: date(client.takeoverDate),
    isEmployer: client.isEmployer ? "on" : "",
    // Les montants sont stockés en centimes ; le formulaire travaille en dirhams.
    feeAmount:
      typeof client.feeAmount === "number" ? String(client.feeAmount / 100) : "",
    feeFrequency: text(client.feeFrequency) || "monthly",
  };
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
