import Link from "next/link";
import { requireStaff } from "@/lib/authz/guard";
import { formatDate } from "@/lib/format";
import { listDocuments } from "@/server/services/documents";
import {
  Badge, Button, EmptyState, PageHeader, Pagination, StatusPill,
  Table, TableWrap, TBody, TD, TH, THead, TR,
} from "@/components/ui";

export const metadata = { title: "Documents — Daftar" };
export const dynamic = "force-dynamic";

export default async function DocumentsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string; status?: string }>;
}) {
  const ctx = await requireStaff("document.view");
  const params = await searchParams;
  const result = await listDocuments(ctx, {
    q: params.q,
    page: params.page ?? 1,
    status: params.status,
  });

  const buildHref = (page: number) => {
    const query = new URLSearchParams();
    if (params.q) query.set("q", params.q);
    if (params.status) query.set("status", params.status);
    query.set("page", String(page));
    return `/documents?${query.toString()}`;
  };

  return (
    <div className="grid gap-5">
      <PageHeader title="Documents" subtitle={`${result.total} document(s)`} />

      <form method="get" className="flex flex-wrap gap-2">
        <input
          type="search"
          name="q"
          defaultValue={params.q ?? ""}
          placeholder="Nom du fichier…"
          className="flex-1 min-w-56 rounded-md border border-line bg-surface px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        />
        <Button type="submit" variant="secondary">Rechercher</Button>
      </form>

      {result.items.length === 0 ? (
        <EmptyState
          title="Aucun document"
          description="Les pièces déposées par le cabinet ou par les clients apparaîtront ici."
        />
      ) : (
        <>
          <TableWrap>
            <Table>
              <THead>
                <TR>
                  <TH>Fichier</TH>
                  <TH>Dossier</TH>
                  <TH>Catégorie</TH>
                  <TH>Date</TH>
                  <TH>État</TH>
                  <TH numeric>Taille</TH>
                </TR>
              </THead>
              <TBody>
                {result.items.map((document) => (
                  <TR key={document.id}>
                    <TD>
                      <a
                        href={`/api/documents/${document.id}/download`}
                        className="hover:underline underline-offset-2"
                      >
                        {document.filename}
                      </a>
                    </TD>
                    <TD>
                      {document.client ? (
                        <Link
                          href={`/clients/${document.client.id}`}
                          className="hover:underline underline-offset-2"
                        >
                          {document.client.legalName}
                        </Link>
                      ) : (
                        <span className="text-muted">—</span>
                      )}
                    </TD>
                    <TD>{document.category?.name ?? <span className="text-muted">—</span>}</TD>
                    <TD>
                      <span className="tabular">{formatDate(document.createdAt)}</span>
                    </TD>
                    <TD><StatusPill status={document.status} /></TD>
                    <TD numeric>
                      <Badge>{Math.round(document.size / 1024)} Ko</Badge>
                    </TD>
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
