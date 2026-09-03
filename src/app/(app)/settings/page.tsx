import { requireStaff } from "@/lib/authz/guard";
import { getEntitlements } from "@/lib/billing/entitlements";
import { platformDb } from "@/lib/db/tenant";
import { Alert, Badge, Card, PageHeader, Table, TableWrap, TBody, TD, TH, THead, TR } from "@/components/ui";

export const metadata = { title: "Paramètres — Direct Conseil" };
export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const ctx = await requireStaff("cabinet.view");
  const [entitlements, cabinet, rules] = await Promise.all([
    getEntitlements(ctx.cabinet.id).catch(() => null),
    ctx.db.cabinet.findFirst({ where: { id: ctx.cabinet.id } }),
    ctx.db.deadlineRule.findMany({ orderBy: { code: "asc" } }),
  ]);

  const toConfirm = rules.filter((rule) => rule.verificationStatus !== "verified");

  return (
    <div className="grid gap-5">
      <PageHeader title="Paramètres" subtitle={ctx.cabinet.name} />

      <Card title="Abonnement et usage">
        {entitlements ? (
          <div className="grid gap-3">
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-lg font-medium">{entitlements.planName}</span>
              <Badge tone="green">Gratuit</Badge>
            </div>
            <TableWrap>
              <Table>
                <THead>
                  <TR>
                    <TH>Ressource</TH>
                    <TH numeric>Utilisé</TH>
                    <TH numeric>Limite du plan</TH>
                  </TR>
                </THead>
                <TBody>
                  <TR>
                    <TD>Dossiers clients</TD>
                    <TD numeric>{entitlements.usage.clients}</TD>
                    <TD numeric>{entitlements.limits.maxClients ?? "illimité"}</TD>
                  </TR>
                  <TR>
                    <TD>Utilisateurs</TD>
                    <TD numeric>{entitlements.usage.users}</TD>
                    <TD numeric>{entitlements.limits.maxUsers ?? "illimité"}</TD>
                  </TR>
                  <TR>
                    <TD>Stockage (Mo)</TD>
                    <TD numeric>{entitlements.usage.storageMb}</TD>
                    <TD numeric>{entitlements.limits.maxStorageMb ?? "illimité"}</TD>
                  </TR>
                  <TR>
                    <TD>Documents ce mois</TD>
                    <TD numeric>{entitlements.usage.monthlyUploads}</TD>
                    <TD numeric>{entitlements.limits.maxMonthlyUploads ?? "illimité"}</TD>
                  </TR>
                </TBody>
              </Table>
            </TableWrap>
          </div>
        ) : (
          <Alert tone="warning">Aucun abonnement actif n&apos;est rattaché à ce cabinet.</Alert>
        )}
      </Card>

      <Card title="Formule">
        <p className="text-sm text-ink2">
          Direct Conseil est <strong>gratuit et sans limite</strong> pendant la phase de
          lancement : nombre de dossiers, d&apos;utilisateurs et volume de stockage illimités,
          sans date d&apos;expiration.
        </p>
        <p className="text-xs text-muted mt-2">
          Aucun paiement n&apos;est demandé et aucun moyen de paiement n&apos;est enregistré.
        </p>
      </Card>

      <Card title="Conformité (loi 09-08)">
        <dl className="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-1.5 text-sm">
          <dt className="text-muted">Mode CNDP</dt>
          <dd>
            {cabinet?.cndpMode === "authorization"
              ? "Autorisation — le numéro de CIN peut être enregistré"
              : "Déclaration — aucun numéro de CIN enregistré"}
          </dd>
          <dt className="text-muted">Référence du dossier</dt>
          <dd>{cabinet?.cndpRef ?? "—"}</dd>
          <dt className="text-muted">Ordre professionnel</dt>
          <dd>
            {cabinet?.ordre ?? "—"} {cabinet?.ordreNum ? `· ${cabinet.ordreNum}` : ""}
          </dd>
          <dt className="text-muted">Hébergement</dt>
          <dd>Maroc</dd>
        </dl>
        <Alert tone="info" className="mt-3">
          Direct Conseil n&apos;est pas « certifié CNDP » : une telle certification n&apos;existe pas.
          Le cabinet reste responsable de traitement et dépose sa propre formalité.
        </Alert>
      </Card>

      <Card title="Règles d'échéances">
        <p className="text-sm text-ink2 mb-2">
          {rules.length} règle(s) actives, dont {toConfirm.length} à faire confirmer par un
          professionnel inscrit avant de s&apos;y fier.
        </p>
        <TableWrap>
          <Table>
            <THead>
              <TR>
                <TH>Code</TH>
                <TH>Obligation</TH>
                <TH>Fréquence</TH>
                <TH>Référence</TH>
                <TH>Vérification</TH>
              </TR>
            </THead>
            <TBody>
              {rules.map((rule) => (
                <TR key={rule.id}>
                  <TD>
                    <span className="tabular text-xs">{rule.code}</span>
                  </TD>
                  <TD>{rule.label}</TD>
                  <TD>{rule.frequency}</TD>
                  <TD>
                    <span className="text-xs text-muted">{rule.legalRef ?? "—"}</span>
                  </TD>
                  <TD>
                    <Badge tone={rule.verificationStatus === "verified" ? "green" : "amber"}>
                      {rule.verificationStatus === "verified" ? "Vérifiée" : "À confirmer"}
                    </Badge>
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </TableWrap>
      </Card>
    </div>
  );
}
