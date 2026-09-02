import Link from "next/link";
import { requireStaff } from "@/lib/authz/guard";
import { formatDate, formatMad } from "@/lib/format";
import { invoiceSummary, listInvoices } from "@/server/services/invoices";
import {
  EmptyState, PageHeader, StatTile, StatusPill,
  Table, TableWrap, TBody, TD, TH, THead, TR,
} from "@/components/ui";

export const metadata = { title: "Honoraires — Daftar" };
export const dynamic = "force-dynamic";

export default async function InvoicesPage() {
  const ctx = await requireStaff("invoice.view");
  const [summary, invoices] = await Promise.all([
    invoiceSummary(ctx),
    listInvoices(ctx, { status: "unpaid" }),
  ]);

  return (
    <div className="grid gap-5">
      <PageHeader title="Honoraires" subtitle="Ce que le cabinet facture et encaisse" />

      <section className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        <StatTile label="Impayés" value={formatMad(summary.outstanding)} tone={summary.outstanding > 0 ? "warning" : "neutral"} hint={`${summary.outstandingCount} facture(s)`} />
        <StatTile label="En retard" value={formatMad(summary.overdue)} tone={summary.overdueCount > 0 ? "danger" : "neutral"} hint={`${summary.overdueCount} facture(s)`} />
        <StatTile label="Encaissé" value={formatMad(summary.paidTotal)} tone="success" hint={`${summary.paidCount} facture(s)`} />
        <StatTile label="Factures ouvertes" value={invoices.length} />
      </section>

      {invoices.length === 0 ? (
        <EmptyState title="Aucune facture ouverte" description="Tout est encaissé." />
      ) : (
        <TableWrap>
          <Table>
            <THead>
              <TR>
                <TH>Référence</TH>
                <TH>Dossier</TH>
                <TH>Échéance</TH>
                <TH>État</TH>
                <TH numeric>Montant HT</TH>
                <TH numeric>Reste dû</TH>
              </TR>
            </THead>
            <TBody>
              {invoices.map((invoice) => (
                <TR key={invoice.id}>
                  <TD><span className="tabular">{invoice.reference}</span></TD>
                  <TD>
                    <Link href={`/clients/${invoice.clientId}`} className="hover:underline underline-offset-2">
                      {invoice.client.legalName}
                    </Link>
                  </TD>
                  <TD><span className="tabular">{formatDate(invoice.dueDate)}</span></TD>
                  <TD><StatusPill status={invoice.status} /></TD>
                  <TD numeric>{formatMad(invoice.amount)}</TD>
                  <TD numeric>{formatMad(invoice.amount - invoice.paidAmount)}</TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </TableWrap>
      )}
    </div>
  );
}
