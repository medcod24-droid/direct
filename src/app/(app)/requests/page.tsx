import Link from "next/link";
import { requireStaff } from "@/lib/authz/guard";
import { formatDate } from "@/lib/format";
import { listRequests } from "@/server/services/requests";
import { Card, EmptyState, PageHeader, StatusPill } from "@/components/ui";
import { ReviewActions } from "./ReviewActions";

export const metadata = { title: "Demandes de pièces — Daftar" };
export const dynamic = "force-dynamic";

export default async function RequestsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const ctx = await requireStaff("request.view");
  const params = await searchParams;
  const status = params.status ?? "all";
  const requests = await listRequests(ctx, { status });

  const toReview = requests.filter((request) => request.status === "submitted");
  const waiting = requests.filter((request) => request.status === "pending");

  return (
    <div className="grid gap-5">
      <PageHeader
        title="Demandes de pièces"
        subtitle={`${toReview.length} à examiner · ${waiting.length} en attente chez les clients`}
      />

      <Card title="À examiner">
        {toReview.length === 0 ? (
          <EmptyState
            title="Rien à examiner"
            description="Les pièces déposées par vos clients apparaîtront ici."
          />
        ) : (
          <ul className="divide-y divide-line">
            {toReview.map((request) => (
              <li key={request.id} className="py-3 flex flex-wrap items-center gap-3">
                <div className="flex-1 min-w-56">
                  <div className="text-sm font-medium">{request.title}</div>
                  <div className="text-xs text-muted">
                    <Link href={`/clients/${request.clientId}`} className="underline underline-offset-2">
                      {request.client.legalName}
                    </Link>
                    {request.periodLabel ? ` · ${request.periodLabel}` : ""}
                    {request.submittedAt ? ` · déposé le ${formatDate(request.submittedAt)}` : ""}
                  </div>
                </div>
                {request.document ? (
                  <a
                    href={`/api/documents/${request.document.id}/download?inline=1`}
                    className="text-sm underline underline-offset-2"
                  >
                    Ouvrir la pièce
                  </a>
                ) : null}
                {ctx.can("request.review") ? <ReviewActions requestId={request.id} /> : null}
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card title="En attente chez les clients">
        {waiting.length === 0 ? (
          <EmptyState title="Aucune demande en attente" description="Tout a été fourni." />
        ) : (
          <ul className="divide-y divide-line">
            {waiting.map((request) => {
              const late = request.dueDate ? request.dueDate.getTime() < Date.now() : false;
              return (
                <li key={request.id} className="py-2.5 flex items-center justify-between gap-3">
                  <div>
                    <div className="text-sm">{request.title}</div>
                    <div className="text-xs text-muted">
                      <Link href={`/clients/${request.clientId}`} className="underline underline-offset-2">
                        {request.client.legalName}
                      </Link>
                      {request.dueDate ? ` · avant le ${formatDate(request.dueDate)}` : ""}
                    </div>
                  </div>
                  <StatusPill status={late ? "overdue" : "pending"} />
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}
