import { Fragment } from "react";
import Link from "next/link";
import { requireStaff } from "@/lib/authz/guard";
import { formatDate, relativeDays } from "@/lib/format";
import { listDeadlines } from "@/server/services/deadlines";
import { getMonthDeadlineSummary } from "@/server/services/dashboard";
import { deadlineStatus } from "@/lib/deadlines/engine";
import { effectiveDeadlineStatus, MANAGED_BY_LABELS } from "@/lib/domain/labels";
import {
  Badge,
  Card,
  CountBadge,
  EmptyState,
  PageHeader,
  SegmentedProgress,
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
import { ManagedBySelect } from "./ManagedBySelect";

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

  const now = new Date();
  const [deadlines, clients, month] = await Promise.all([
    listDeadlines(ctx, { status, clientId, q }),
    ctx.db.client.findMany({
      where: { status: { not: "archived" } },
      select: { id: true, legalName: true },
      orderBy: { legalName: "asc" },
    }),
    getMonthDeadlineSummary(ctx, now),
  ]);

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
        eyebrow="Obligations fiscales et sociales"
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

      {/* L'avancement du mois avant la liste : c'est la question qu'on se pose
          en ouvrant la page, et un total qu'on peut ramener à zéro. */}
      <Card
        icon="calendar"
        title={`Mois en cours — ${MONTHS[now.getUTCMonth()]} ${now.getUTCFullYear()}`}
        description={`${month.deposited} déposées sur ${month.total} · ${month.overdue} en retard`}
      >
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] lg:items-center">
          <div className="flex flex-col gap-2.5">
            <div className="flex items-baseline gap-2.5">
              <span className="text-3xl font-650 text-ink tabular">
                {month.deposited} sur {month.total}
              </span>
              <span className="text-sm text-muted">déposées au titre du mois</span>
            </div>
            <SegmentedProgress
              height={10}
              total={month.total}
              segments={[
                { label: "Payées", value: month.paid, className: "bg-ok" },
                { label: "Déclarées", value: month.declared, className: "bg-accent" },
                { label: "À déposer", value: month.remaining, className: "bg-warn" },
                { label: "En retard", value: month.overdue, className: "bg-danger" },
              ]}
            />
          </div>
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: "Payées", value: month.paid, tone: "text-ok" },
              { label: "À déposer", value: month.remaining, tone: "text-warn" },
              { label: "En retard", value: month.overdue, tone: "text-danger" },
            ].map((tile) => (
              <div
                key={tile.label}
                className="flex flex-col gap-1 rounded-[11px] border border-line bg-bg p-3"
              >
                <span className="text-2xs font-bold uppercase tracking-[0.1em] text-muted">
                  {tile.label}
                </span>
                <span className={`text-xl font-650 tabular ${tile.tone}`}>{tile.value}</span>
                <span className="text-xs text-muted tabular">sur {month.total}</span>
              </div>
            ))}
          </div>
        </div>
      </Card>

      <p className="text-sm text-ink2">
        Les règles proviennent d&apos;une table modifiable, versionnée par loi de finances. Une
        échéance ne passe au vert qu&apos;avec sa preuve de dépôt. Ce qui est géré par le client
        ou par un tiers n&apos;est jamais compté en retard pour le cabinet.
      </p>

      <DeadlineSearch />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <nav className="flex gap-2 text-sm">
          {TABS.map((tab) => (
            <Link
              key={tab.key}
              href={href({ status: tab.key })}
              className={`inline-flex items-center gap-2 rounded-chip border px-3 py-1.5 transition-colors ${
                status === tab.key
                  ? "border-accent bg-accentSoft font-650 text-accent"
                  : "border-line text-ink2 hover:bg-surface2 hover:text-ink"
              }`}
            >
              {tab.label}
              {tab.key === "overdue" && overdue.length > 0 ? (
                <CountBadge value={overdue.length} tone="danger" />
              ) : null}
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
          iconName="calendar"
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
                      <TD className="whitespace-nowrap">
                        {ctx.can("deadline.update") ? (
                          <ManagedBySelect id={deadline.id} managedBy={deadline.managedBy} />
                        ) : (
                          <Badge tone={deadline.managedBy === "cabinet" ? "accent" : "neutral"}>
                            {MANAGED_BY_LABELS[deadline.managedBy] ?? deadline.managedBy}
                          </Badge>
                        )}
                      </TD>
                      <TD className="whitespace-nowrap">
                        <StatusPill status={effectiveDeadlineStatus(deadline)} />
                        {/* Déclarer après l'échéance n'efface pas le retard — c'est la
                            règle du moteur — mais l'action doit rester visible. */}
                        {deadline.status === "declared" ? (
                          <div className="mt-0.5 text-xs text-muted">
                            déclarée
                            {deadline.declaredAt ? ` le ${formatDate(deadline.declaredAt)}` : ""}
                          </div>
                        ) : null}
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
