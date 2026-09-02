import { requireStaff } from "@/lib/authz/guard";
import { formatDate } from "@/lib/format";
import { platformDb } from "@/lib/db/tenant";
import { ROLE_LABELS } from "@/lib/domain/labels";
import { Badge, Card, PageHeader, Table, TableWrap, TBody, TD, TH, THead, TR } from "@/components/ui";

export const metadata = { title: "Équipe — Daftar" };
export const dynamic = "force-dynamic";

export default async function TeamPage() {
  const ctx = await requireStaff("member.view");

  // Les membres sont lus via le contexte (donc bornés au cabinet) ; le nom et l'e-mail
  // sont ensuite résolus par identifiant, sans jamais lister les utilisateurs globalement.
  const memberships = await ctx.db.membership.findMany({ orderBy: { createdAt: "asc" } });
  const users = await platformDb.user.findMany({
    where: { id: { in: memberships.map((m) => m.userId) } },
    select: { id: true, name: true, email: true, lastLoginAt: true },
  });
  const byId = new Map(users.map((user) => [user.id, user]));

  return (
    <div className="grid gap-5">
      <PageHeader
        title="Équipe"
        subtitle={`${memberships.filter((m) => m.role !== "client").length} collaborateur(s)`}
      />

      <Card>
        <TableWrap>
          <Table>
            <THead>
              <TR>
                <TH>Nom</TH>
                <TH>E-mail</TH>
                <TH>Rôle</TH>
                <TH>Portée</TH>
                <TH>Dernière connexion</TH>
              </TR>
            </THead>
            <TBody>
              {memberships.map((membership) => {
                const user = byId.get(membership.userId);
                return (
                  <TR key={membership.id}>
                    <TD>{user?.name ?? "—"}</TD>
                    <TD><span className="text-xs">{user?.email ?? "—"}</span></TD>
                    <TD><Badge tone={membership.role === "client" ? "neutral" : "accent"}>{ROLE_LABELS[membership.role] ?? membership.role}</Badge></TD>
                    <TD>
                      {membership.role === "client"
                        ? "Son dossier"
                        : membership.restrictedToAssigned
                          ? "Dossiers assignés"
                          : "Tous les dossiers"}
                    </TD>
                    <TD>
                      <span className="tabular text-xs">
                        {user?.lastLoginAt ? formatDate(user.lastLoginAt) : "jamais"}
                      </span>
                    </TD>
                  </TR>
                );
              })}
            </TBody>
          </Table>
        </TableWrap>
      </Card>
    </div>
  );
}
