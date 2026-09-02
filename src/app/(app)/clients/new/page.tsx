import { requireStaff } from "@/lib/authz/guard";
import { PageHeader } from "@/components/ui";
import { NewClientForm } from "./NewClientForm";

export const metadata = { title: "Nouveau dossier — Daftar" };

export default async function NewClientPage() {
  const ctx = await requireStaff("client.create");
  return (
    <div className="grid gap-5 max-w-3xl">
      <PageHeader
        title="Nouveau dossier client"
        subtitle="Les champs marqués sont indispensables au calcul des échéances."
      />
      <NewClientForm cndpMode={ctx.cabinet.cndpMode} />
    </div>
  );
}
