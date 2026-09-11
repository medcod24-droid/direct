import Link from "next/link";
import { requireStaff, type AuthContext } from "@/lib/authz/guard";
import { GRANTABLE } from "@/lib/authz/permissions";
import { formatDate } from "@/lib/format";
import { roleName } from "@/lib/domain/labels";
import { editableMember, listMembers, type TeamMember } from "@/server/services/members";
import {
  Badge,
  Card,
  PageHeader,
  ProgressBar,
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

/** Pourquoi une ligne n'offre pas de réglage — ou `null` si elle en offre. */
function lockReason(ctx: AuthContext, member: TeamMember): string | null {
  if (member.isSelf) return "Vos propres droits";
  if (member.role === "owner") return "Propriétaire du cabinet";
  if (member.role === "client") return "Compte client";
  if (member.permissions.some((permission) => !ctx.can(permission))) {
    return "Droits supérieurs aux vôtres";
  }
  return null;
}

export default async function TeamPage() {
  const ctx = await requireStaff("member.view");
  const canManage = ctx.can("member.manage");
  const canInvite = ctx.can("member.invite");
  // On n'accorde que ce qu'on détient : la grille grise le reste.
  const grantable = GRANTABLE.filter((permission) => ctx.can(permission));

  const members = await listMembers(ctx);
  const staff = members.filter((member) => member.role !== "client");

  return (
    <div className="grid gap-5">
      <PageHeader
        eyebrow="Cabinet"
        title="Équipe"
        subtitle={`${staff.length} collaborateur(s) · ouvrez une fiche pour voir ses droits, ses tâches et son historique`}
        actions={canInvite ? <AddMember grantable={grantable} /> : null}
      />

      <Card padded={false}>
        <TableWrap>
          <Table minWidth={canManage ? 1080 : 800} label="Collaborateurs du cabinet">
            <THead>
              <TR>
                <TH>Nom</TH>
                <TH>Rôle</TH>
                <TH>Droits</TH>
                <TH>Portée</TH>
                <TH>Dernière connexion</TH>
                {canManage ? <TH>Actions</TH> : null}
              </TR>
            </THead>
            <TBody>
              {members.map((member) => {
                const reason = lockReason(ctx, member);
                return (
                  <TR key={member.membershipId}>
                    <TD>
                      {/* La fiche porte les droits, l'historique et les tâches :
                          c'est là que l'administrateur va voir ce qu'il a fait. */}
                      <Link
                        href={`/team/${member.userId}`}
                        className="font-550 underline underline-offset-2 hover:no-underline"
                      >
                        {member.name}
                      </Link>
                      {member.isSelf ? <span className="ms-1.5 text-xs text-muted">(vous)</span> : null}
                      <span className="block text-xs text-muted">{member.email}</span>
                    </TD>
                    <TD>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <Badge tone={member.role === "client" ? "neutral" : "accent"}>
                          {roleName(member.role, member.roleLabel)}
                        </Badge>
                        {member.adjusted ? (
                          <span
                            className="text-xs text-muted"
                            title="Les cases diffèrent du rôle standard"
                          >
                            ajusté
                          </span>
                        ) : null}
                      </div>
                    </TD>
                    <TD>
                      {member.role === "client" ? (
                        <span className="text-xs text-muted">Portail client</span>
                      ) : member.role === "owner" ? (
                        <span className="text-xs text-muted">Tous</span>
                      ) : (
                        <div className="grid w-28 gap-1">
                          <span className="tabular text-xs text-ink2">
                            {member.permissions.length} / {GRANTABLE.length}
                          </span>
                          <ProgressBar
                            value={member.permissions.length}
                            total={GRANTABLE.length}
                            height={4}
                            label="Droits accordés"
                          />
                        </div>
                      )}
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
                          member={editableMember(member)}
                          grantable={grantable}
                          locked={reason !== null}
                          lockedReason={reason ?? undefined}
                        />
                      </TD>
                    ) : null}
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
