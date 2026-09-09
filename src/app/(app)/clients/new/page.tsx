import { requireStaff } from "@/lib/authz/guard";
import { listReferrers } from "@/server/services/clients";
import { PageHeader } from "@/components/ui";
import { NewClientForm } from "./NewClientForm";

export const metadata = { title: "Nouveau dossier — Direct Conseil" };

export default async function NewClientPage() {
  const ctx = await requireStaff("client.create");
  const referrers = await listReferrers(ctx);
  return (
    <div className="grid gap-5 max-w-3xl">
      <PageHeader
        title="Nouveau dossier client"
        subtitle="Les champs marqués sont indispensables au calcul des échéances."
      />
      <NewClientForm cndpMode={ctx.cabinet.cndpMode} referrers={referrers} />
    </div>
  );
}
