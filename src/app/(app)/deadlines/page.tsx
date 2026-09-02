import Link from "next/link";
import { requireStaff } from "@/lib/authz/guard";
import { formatDate, relativeDays } from "@/lib/format";
import { listDeadlines } from "@/server/services/deadlines";
import { deadlineStatus } from "@/lib/deadlines/engine";
import { effectiveDeadlineStatus, MANAGED_BY_LABELS } from "@/lib/domain/labels";
import {
  Badge,
  Card,
  EmptyState,
  PageHeader,
  StatusPill,
  Table,
  TableWrap,
  TBody,
  TD,
  TH,
  THead,
  TR,
} from "@/components/ui";
import { DeadlineActions, GenerateButton } from "./DeadlineActions";

export const metadata = { title: "Échéances — Daftar" };
export const dynamic = "force-dynamic";

export default async function DeadlinesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const ctx = await requireStaff("deadline.view");
  const params = await searchParams;
  const status = params.status ?? "open";
  const deadlines = await listDeadlines(ctx, { status });

  const now = new Date();
  const overdue = deadlines.filter(
    (d) => d.managedBy === "cabinet" && deadlineStatus({ status: d.status, dueDate: d.dueDate, now }) === "overdue",
  );

  return (
    <div className="grid gap-5">
      <PageHeader
        title="Échéances"
        subtitle={`${deadlines.length} échéance(s) · ${overdue.length} en retard`}
        actions={ctx.can("deadline.generate") ? <GenerateButton year={now.getUTCFullYear()} /> : null}
      />

      <Card>
        <p className="text-sm text-ink2">
          Les règles proviennent d&apos;une table modifiable, versionnée par loi de finances.
          Une échéance ne passe au vert qu&apos;avec sa preuve de dépôt. Ce qui est géré par le
          client ou par un tiers n&apos;est jamais compté en retard pour le cabinet.
        </p>
      </Card>

      <nav className="flex gap-2 text-sm">
        {[
          { key: "open", label: "Ouvertes" },
          { key: "overdue", label: "En retard" },
          { key: "paid", label: "Payées" },
          { key: "all", label: "Toutes" },
        ].map((tab) => (
          <Link
            key={tab.key}
            href={`/deadlines?status=${tab.key}`}
            className={`px-3 py-1.5 rounded-md border ${
              status === tab.key
                ? "border-accent text-accentInk bg-accentSoft"
                : "border-line text-ink2 hover:bg-surface2"
            }`}
          >
            {tab.label}
          </Link>
        ))}
      </nav>

      {deadlines.length === 0 ? (
        <EmptyState
          title="Aucune échéance"
          description="Générez le calendrier de l'année pour vos dossiers actifs."
          action={ctx.can("deadline.generate") ? <GenerateButton year={now.getUTCFullYear()} /> : null}
        />
      ) : (
        <TableWrap>
          <Table>
            <THead>
              <TR>
                <TH>Dossier</TH>
                <TH>Obligation</TH>
                <TH>Période</TH>
                <TH>Échéance</TH>
                <TH>Gérée par</TH>
                <TH>État</TH>
                <TH>Preuve</TH>
                <TH>Actions</TH>
              </TR>
            </THead>
            <TBody>
              {deadlines.map((deadline) => (
                <TR key={deadline.id}>
                  <TD>
                    <Link
                      href={`/clients/${deadline.clientId}`}
                      className="hover:underline underline-offset-2"
                    >
                      {deadline.client.legalName}
                    </Link>
                  </TD>
                  <TD>{deadline.label}</TD>
                  <TD>
                    <span className="text-xs text-muted">{deadline.periodLabel}</span>
                  </TD>
                  <TD>
                    <div className="tabular">{formatDate(deadline.dueDate)}</div>
                    <div className="text-xs text-muted">{relativeDays(deadline.dueDate)}</div>
                  </TD>
                  <TD>
                    <Badge tone={deadline.managedBy === "cabinet" ? "accent" : "neutral"}>
                      {MANAGED_BY_LABELS[deadline.managedBy] ?? deadline.managedBy}
                    </Badge>
                  </TD>
                  <TD>
                    <StatusPill status={effectiveDeadlineStatus(deadline)} />
                  </TD>
                  <TD>
                    {deadline.proof ? (
                      <a
                        href={`/api/documents/${deadline.proof.id}/download`}
                        className="text-xs underline underline-offset-2"
                      >
                        {deadline.proof.filename}
                      </a>
                    ) : (
                      <span className="text-xs text-muted">—</span>
                    )}
                  </TD>
                  <TD>
                    {ctx.can("deadline.update") ? (
                      <DeadlineActions id={deadline.id} status={deadline.status} />
                    ) : null}
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </TableWrap>
      )}
    </div>
  );
}
