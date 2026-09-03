import { requireStaff } from "@/lib/authz/guard";
import { formatDate } from "@/lib/format";
import { ROLE_LABELS } from "@/lib/domain/labels";
import { listMembers, listPendingInvitations } from "@/server/services/members";
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
import { InviteMember, MemberControls, RevokeInvitation } from "./TeamControls";

export const metadata = { title: "Équipe — Direct Conseil" };
export const dynamic = "force-dynamic";

export default async function TeamPage() {
  const ctx = await requireStaff("member.view");
  const canManage = ctx.can("member.manage");
  const canInvite = ctx.can("member.invite");

  const [members, invitations] = await Promise.all([
    listMembers(ctx),
    canInvite ? listPendingInvitations(ctx) : Promise.resolve([]),
  ]);

  const staff = members.filter((member) => member.role !== "client");

  return (
    <div className="grid gap-5">
      <PageHeader
        title="Équipe"
        subtitle={`${staff.length} collaborateur(s)`}
        actions={canInvite ? <InviteMember /> : null}
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
                    {member.name}
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

      {canInvite ? (
        <Card
          title="Invitations en attente"
          description="Un lien reste valable 7 jours et ne sert qu'une fois."
        >
          {invitations.length === 0 ? (
            <EmptyState
              title="Aucune invitation en attente"
              description="Les collaborateurs invités apparaîtront ici jusqu'à leur première connexion."
            />
          ) : (
            <ul className="divide-y divide-line">
              {invitations.map((invitation) => (
                <li
                  key={invitation.id}
                  className="flex flex-wrap items-center justify-between gap-3 py-2.5"
                >
                  <div className="min-w-0">
                    <div className="text-sm">{invitation.email}</div>
                    <div className="text-xs text-muted">
                      {ROLE_LABELS[invitation.role] ?? invitation.role} · expire le{" "}
                      {formatDate(invitation.expiresAt)}
                    </div>
                  </div>
                  <RevokeInvitation id={invitation.id} />
                </li>
              ))}
            </ul>
          )}
        </Card>
      ) : null}
    </div>
  );
}
