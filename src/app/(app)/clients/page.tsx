import Link from "next/link";
import { requireStaff } from "@/lib/authz/guard";
import { subtypeLabel } from "@/lib/domain/labels";
import { listClients } from "@/server/services/clients";
import {
  Badge,
  Button,
  EmptyState,
  PageHeader,
  Pagination,
  StatusPill,
  Table,
  TBody,
  TD,
  TH,
  THead,
  TR,
  TableWrap,
} from "@/components/ui";

export const metadata = { title: "Clients — Direct Conseil" };
export const dynamic = "force-dynamic";

export default async function ClientsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; page?: string }>;
}) {
  const ctx = await requireStaff("client.view");
  const params = await searchParams;
  const result = await listClients(ctx, {
    q: params.q,
    status: params.status,
    page: params.page ?? 1,
  });

  const buildHref = (page: number) => {
    const query = new URLSearchParams();
    if (params.q) query.set("q", params.q);
    if (params.status) query.set("status", params.status);
    query.set("page", String(page));
    return `/clients?${query.toString()}`;
  };

  return (
    <div className="grid gap-5">
      <PageHeader
        title="Clients"
        subtitle={`${result.total} dossier(s)`}
        actions={
          ctx.can("client.create") ? (
            <Button href="/clients/new">Nouveau dossier</Button>
          ) : null
        }
      />

      <form method="get" className="flex flex-wrap gap-2">
        <input
          type="search"
          name="q"
          defaultValue={params.q ?? ""}
          placeholder="Nom, ICE, IF, RC, téléphone…"
          className="flex-1 min-w-56 rounded-md border border-line bg-surface px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        />
        <select
          name="status"
          defaultValue={params.status ?? "all"}
          className="rounded-md border border-line bg-surface px-3 py-2 text-sm"
        >
          <option value="all">Tous les statuts</option>
          <option value="active">Actifs</option>
          <option value="onboarding">En cours d&apos;intégration</option>
          <option value="prospect">Prospects</option>
          <option value="suspended">Suspendus</option>
          <option value="archived">Archivés</option>
        </select>
        <Button type="submit" variant="secondary">
          Rechercher
        </Button>
      </form>

      {result.items.length === 0 ? (
        <EmptyState
          title="Aucun dossier"
          description={
            params.q
              ? "Aucun résultat pour cette recherche."
              : "Créez votre premier dossier client, ou importez votre fichier Excel."
          }
          action={ctx.can("client.create") ? <Button href="/clients/new">Nouveau dossier</Button> : null}
        />
      ) : (
        <>
          <TableWrap>
            <Table>
              <THead>
                <TR>
                  <TH>Dossier</TH>
                  <TH>Forme</TH>
                  <TH>ICE</TH>
                  <TH>Ville</TH>
                  <TH>État</TH>
                  <TH numeric>Échéances</TH>
                </TR>
              </THead>
              <TBody>
                {result.items.map((client) => (
                  <TR key={client.id}>
                    <TD>
                      <Link
                        href={`/clients/${client.id}`}
                        className="font-medium hover:underline underline-offset-2"
                      >
                        {client.legalName}
                      </Link>
                    </TD>
                    <TD>
                      <Badge>{subtypeLabel(client.subtype)}</Badge>
                    </TD>
                    <TD>
                      <span className="tabular text-xs">{client.ice ?? "—"}</span>
                    </TD>
                    <TD>{client.city ?? "—"}</TD>
                    <TD>
                      <StatusPill status={client.health.status} title={client.health.reasons.join(" · ")} />
                    </TD>
                    <TD numeric>{client.openDeadlines}</TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </TableWrap>
          <Pagination page={result.page} pageCount={result.pageCount} buildHref={buildHref} />
        </>
      )}
    </div>
  );
}
