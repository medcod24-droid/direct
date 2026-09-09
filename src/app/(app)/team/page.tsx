import Link from "next/link";
import { requireStaff } from "@/lib/authz/guard";
import { formatDate } from "@/lib/format";
import { ROLE_LABELS } from "@/lib/domain/labels";
import { listMembers } from "@/server/services/members";
import {
  Badge,
  Card,
  EmptyState,
  PageHeader,
  Table,
  TableWrap,
  TBody,
  TD,
  TH,
  THead,
  TR,
} from "@/components/ui";
import { AddMember, MemberControls } from "./TeamControls";

export const metadata = { title: "Équipe — Direct Conseil" };
export const dynamic = "force-dynamic";

export default async function TeamPage() {
  const ctx = await requireStaff("member.view");
  const canManage = ctx.can("member.manage");
  const canInvite = ctx.can("member.invite");

  const members = await listMembers(ctx);

  const staff = members.filter((member) => member.role !== "client");

  return (
    <div className="grid gap-5">
      <PageHeader
        title="Équipe"
        subtitle={`${staff.length} collaborateur(s) · ouvrez une fiche pour voir ses tâches et son historique`}
        actions={canInvite ? <AddMember /> : null}
      />

      <Card padded={false}>
        <TableWrap>
          <Table minWidth={canManage ? 1040 : 760} label="Collaborateurs du cabinet">
            <THead>
              <TR>
                <TH>Nom</TH>
                <TH>E-mail</TH>
                <TH>Rôle</TH>
                <TH>Portée</TH>
                <TH>Dernière connexion</TH>
                {canManage ? <TH>Droits</TH> : null}
              </TR>
            </THead>
            <TBody>
              {members.map((member) => (
                <TR key={member.membershipId}>
                  <TD>
                    {/* La fiche porte l'historique du collaborateur et ses tâches :
                        c'est là que l'administrateur va voir ce qu'il a fait. */}
                    <Link
                      href={`/team/${member.userId}`}
                      className="underline underline-offset-2 hover:no-underline"
                    >
                      {member.name}
                    </Link>
                    {member.isSelf ? <span className="ms-1.5 text-xs text-muted">(vous)</span> : null}
                  </TD>
                  <TD>
                    <span className="text-xs">{member.email}</span>
                  </TD>
                  <TD>
                    <Badge tone={member.role === "client" ? "neutral" : "accent"}>
                      {ROLE_LABELS[member.role] ?? member.role}
                    </Badge>
                  </TD>
                  <TD>
                    {member.role === "client"
                      ? "Son dossier"
                      : member.restrictedToAssigned
                        ? "Dossiers assignés"
                        : "Tous les dossiers"}
                  </TD>
                  <TD>
                    <span className="tabular text-xs">
                      {member.lastLoginAt ? formatDate(member.lastLoginAt) : "jamais"}
                    </span>
                  </TD>
                  {canManage ? (
                    <TD>
                      <MemberControls
                        membershipId={member.membershipId}
                        name={member.name}
                        role={member.role}
                        restrictedToAssigned={member.restrictedToAssigned}
                        // Ni soi-même — pour ne pas se verrouiller — ni le propriétaire,
                        // dont le rôle se transmet au lieu de se retirer.
                        locked={member.isSelf || member.role === "owner" || member.role === "client"}
                        lockedReason={
                          member.isSelf
                            ? "Vos propres droits"
                            : member.role === "owner"
                              ? "Propriétaire du cabinet"
                              : "Compte client"
                        }
                      />
                    </TD>
                  ) : null}
                </TR>
              ))}
            </TBody>
          </Table>
        </TableWrap>
      </Card>
    </div>
  );
}
