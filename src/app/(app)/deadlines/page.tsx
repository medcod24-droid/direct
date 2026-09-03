import { Fragment } from "react";
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
import { ClientFilter, DeadlineSearch } from "./DeadlineFilters";

export const metadata = { title: "Échéances — Direct Conseil" };
export const dynamic = "force-dynamic";

const TABS = [
  { key: "open", label: "Ouvertes" },
  { key: "overdue", label: "En retard" },
  { key: "paid", label: "Payées" },
  { key: "all", label: "Toutes" },
] as const;

const MONTHS = [
  "janvier", "février", "mars", "avril", "mai", "juin",
  "juillet", "août", "septembre", "octobre", "novembre", "décembre",
];

/** Clé de regroupement : un mois calendaire, dans le fuseau des échéances (UTC). */
function monthKey(date: Date) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth()).padStart(2, "0")}`;
}

function monthLabel(date: Date) {
  return `${MONTHS[date.getUTCMonth()]} ${date.getUTCFullYear()}`;
}

export default async function DeadlinesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; client?: string; q?: string }>;
}) {
  const ctx = await requireStaff("deadline.view");
  const params = await searchParams;
  const status = params.status ?? "open";
  const clientId = params.client || undefined;
  const q = params.q?.trim() || undefined;

  const [deadlines, clients] = await Promise.all([
    listDeadlines(ctx, { status, clientId, q }),
    ctx.db.client.findMany({
      where: { status: { not: "archived" } },
      select: { id: true, legalName: true },
      orderBy: { legalName: "asc" },
    }),
  ]);

  const now = new Date();
  const overdue = deadlines.filter(
    (d) =>
      d.managedBy === "cabinet" &&
      deadlineStatus({ status: d.status, dueDate: d.dueDate, now }) === "overdue",
  );

  // Le dossier choisi peut ne plus exister (lien ancien) : on ne l'affiche que s'il est
  // réellement dans la portée du contexte courant.
  const selected = clientId ? clients.find((c) => c.id === clientId) : undefined;

  // Regroupement par mois. La liste arrive déjà triée par date par le service :
  // un simple parcours suffit, sans retrier ici.
  const groups: { key: string; label: string; items: typeof deadlines }[] = [];
  for (const deadline of deadlines) {
    const key = monthKey(deadline.dueDate);
    const last = groups.at(-1);
    if (last?.key === key) last.items.push(deadline);
    else groups.push({ key, label: monthLabel(deadline.dueDate), items: [deadline] });
  }

  const href = (next: { status?: string; client?: string }) => {
    const query = new URLSearchParams();
    const nextStatus = next.status ?? status;
    const nextClient = next.client ?? clientId;
    if (nextStatus !== "open") query.set("status", nextStatus);
    if (nextClient) query.set("client", nextClient);
    if (q) query.set("q", q);
    const qs = query.toString();
    return qs ? `/deadlines?${qs}` : "/deadlines";
  };

  return (
    <div className="grid gap-5">
      <PageHeader
        title="Échéances"
        subtitle={
          selected
            ? `${selected.legalName} · ${deadlines.length} échéance(s) · ${overdue.length} en retard`
            : `${deadlines.length} échéance(s) · ${overdue.length} en retard`
        }
        actions={
          ctx.can("deadline.generate") ? <GenerateButton year={now.getUTCFullYear()} /> : null
        }
      />

      <Card>
        <p className="text-sm text-ink2">
          Les règles proviennent d&apos;une table modifiable, versionnée par loi de finances.
          Une échéance ne passe au vert qu&apos;avec sa preuve de dépôt. Ce qui est géré par le
          client ou par un tiers n&apos;est jamais compté en retard pour le cabinet.
        </p>
      </Card>

      <DeadlineSearch />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <nav className="flex gap-2 text-sm">
          {TABS.map((tab) => (
            <Link
              key={tab.key}
              href={href({ status: tab.key })}
              className={`px-3 py-1.5 rounded-md border ${
                status === tab.key
                  ? "border-accent text-accent bg-accentSoft"
                  : "border-line text-ink2 hover:bg-surface2"
              }`}
            >
              {tab.label}
            </Link>
          ))}
        </nav>
        <ClientFilter clients={clients} />
      </div>

      {selected ? (
        <div className="flex items-center gap-2 text-sm">
          <Badge tone="accent">{selected.legalName}</Badge>
          <Link href={href({ client: "" })} className="text-muted hover:underline underline-offset-2">
            Retirer le filtre
          </Link>
        </div>
      ) : null}

      {deadlines.length === 0 ? (
        <EmptyState
          title="Aucune échéance"
          description={
            q
              ? `Aucun résultat pour « ${q} » dans cet onglet.`
              : selected
                ? `Aucune échéance ne correspond pour ${selected.legalName} dans cet onglet.`
                : "Générez le calendrier de l'année pour vos dossiers actifs."
          }
          action={
            ctx.can("deadline.generate") ? <GenerateButton year={now.getUTCFullYear()} /> : null
          }
        />
      ) : (
        <TableWrap>
          <Table minWidth={1000} label="Échéances du cabinet">
            <THead>
              <TR>
                {selected ? null : <TH>Dossier</TH>}
                <TH>Obligation</TH>
                <TH>Échéance</TH>
                <TH>Gérée par</TH>
                <TH>État</TH>
                <TH>Preuve</TH>
                <TH>Actions</TH>
              </TR>
            </THead>
            <TBody>
              {groups.map((group) => (
                <Fragment key={group.key}>
                  <TR>
                    <TD
                      colSpan={selected ? 6 : 7}
                      className="bg-surface2 text-xs uppercase tracking-wide text-muted"
                    >
                      {group.label} · {group.items.length} échéance(s)
                    </TD>
                  </TR>
                  {group.items.map((deadline) => (
                    <TR key={deadline.id}>
                      {selected ? null : (
                        <TD>
                          <Link
                            href={`/clients/${deadline.clientId}`}
                            className="hover:underline underline-offset-2"
                          >
                            {deadline.client.legalName}
                          </Link>
                        </TD>
                      )}
                      <TD>
                        <div>{deadline.label}</div>
                        <div className="text-xs text-muted">{deadline.periodLabel}</div>
                      </TD>
                      <TD className="whitespace-nowrap">
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
                      <TD className="whitespace-nowrap">
                        {ctx.can("deadline.update") ? (
                          <DeadlineActions
                            id={deadline.id}
                            clientId={deadline.clientId}
                            status={deadline.status}
                            hasProof={Boolean(deadline.proofDocumentId)}
                          />
                        ) : null}
                      </TD>
                    </TR>
                  ))}
                </Fragment>
              ))}
            </TBody>
          </Table>
        </TableWrap>
      )}
    </div>
  );
}
