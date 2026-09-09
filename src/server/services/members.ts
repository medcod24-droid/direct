import { z } from "zod";
import { recordAudit } from "@/lib/audit";
import { assertPasswordPolicy, hashPassword } from "@/lib/auth/password";
import { hashToken, newToken } from "@/lib/auth/session";
import type { AuthContext } from "@/lib/authz/guard";
import { assertWithinLimit } from "@/lib/billing/entitlements";
import { platformDb } from "@/lib/db/tenant";
import type { Role } from "@/lib/domain/enums";
import { ForbiddenError, NotFoundError, ValidationError } from "@/lib/errors";
import { buildSearchKey } from "@/lib/search";
import { cabinetSettingsSchema, inviteSchema } from "@/lib/validation/schemas";

/**
 * Équipe du cabinet : invitations et droits des collaborateurs.
 *
 * Deux règles tiennent tout le fichier :
 * - le rôle « propriétaire » ne s'invite pas et ne se retire jamais au dernier
 *   qui le porte, sinon le cabinet devient ingérable ;
 * - personne ne modifie ses propres droits, sinon un administrateur pourrait se
 *   verrouiller ou s'élever seul.
 */

const INVITATION_TTL_MS = 1000 * 60 * 60 * 24 * 7; // 7 jours

const memberUpdateSchema = z.object({
  role: z
    .enum(["admin", "accountant", "assistant"] as const)
    .describe("Le rôle propriétaire se transmet, il ne s'attribue pas ici."),
  restrictedToAssigned: z.coerce.boolean().default(false),
});

export type TeamMember = {
  membershipId: string;
  userId: string;
  name: string;
  email: string;
  role: Role;
  restrictedToAssigned: boolean;
  lastLoginAt: Date | null;
  isSelf: boolean;
};

/** Collaborateurs du cabinet, comptes clients exclus. */
export async function listMembers(ctx: AuthContext): Promise<TeamMember[]> {
  // Un collaborateur retiré passe en `revoked` : il ne fait plus partie de
  // l'équipe et ne doit plus figurer dans la liste.
  const memberships = await ctx.db.membership.findMany({
    where: { status: "active" },
    orderBy: { createdAt: "asc" },
  });
  const users = await platformDb.user.findMany({
    where: { id: { in: memberships.map((m) => m.userId) } },
    select: { id: true, name: true, email: true, lastLoginAt: true },
  });
  const byId = new Map(users.map((user) => [user.id, user]));

  return memberships.map((membership) => {
    const user = byId.get(membership.userId);
    return {
      membershipId: membership.id,
      userId: membership.userId,
      name: user?.name ?? "—",
      email: user?.email ?? "—",
      role: membership.role as Role,
      restrictedToAssigned: membership.restrictedToAssigned,
      lastLoginAt: user?.lastLoginAt ?? null,
      isSelf: membership.userId === ctx.user.id,
    };
  });
}

/** Invitations encore ouvertes, la plus récente d'abord. */
export async function listPendingInvitations(ctx: AuthContext) {
  return platformDb.invitation.findMany({
    where: { cabinetId: ctx.cabinet.id, acceptedAt: null, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: "desc" },
    select: { id: true, email: true, role: true, expiresAt: true, createdAt: true },
  });
}

/**
 * Invite un collaborateur.
 *
 * Le jeton en clair n'est renvoyé qu'ici, une seule fois : la base n'en garde
 * que l'empreinte, comme pour les sessions. L'appelant en compose le lien.
 */
export async function inviteMember(ctx: AuthContext, input: unknown) {
  const data = inviteSchema.parse(input);
  await assertWithinLimit(ctx.cabinet.id, "users");

  const existing = await platformDb.user.findUnique({ where: { email: data.email } });
  if (existing) {
    const already = await platformDb.membership.findFirst({
      where: { cabinetId: ctx.cabinet.id, userId: existing.id },
    });
    if (already) throw new ValidationError("Cette personne fait déjà partie du cabinet.");
  }

  // Une invitation en cours sur la même adresse est remplacée : sinon deux liens
  // valides circuleraient pour la même personne.
  await platformDb.invitation.deleteMany({
    where: { cabinetId: ctx.cabinet.id, email: data.email, acceptedAt: null },
  });

  const token = newToken();
  const invitation = await platformDb.invitation.create({
    data: {
      cabinetId: ctx.cabinet.id,
      email: data.email,
      role: data.role,
      tokenHash: hashToken(token),
      expiresAt: new Date(Date.now() + INVITATION_TTL_MS),
      invitedBy: ctx.user.id,
    },
  });

  await recordAudit({
    action: "member.invited",
    cabinetId: ctx.cabinet.id,
    userId: ctx.user.id,
    resourceType: "Invitation",
    resourceId: invitation.id,
    metadata: { email: data.email, role: data.role },
    ip: ctx.ip,
  });

  return { invitation, token };
}

export async function revokeInvitation(ctx: AuthContext, invitationId: string) {
  const { count } = await platformDb.invitation.deleteMany({
    where: { id: invitationId, cabinetId: ctx.cabinet.id, acceptedAt: null },
  });
  if (count === 0) throw new NotFoundError("Invitation");

  await recordAudit({
    action: "member.invitation_revoked",
    cabinetId: ctx.cabinet.id,
    userId: ctx.user.id,
    resourceType: "Invitation",
    resourceId: invitationId,
    ip: ctx.ip,
  });
}

/** Modifie le rôle et la portée d'un collaborateur. */
export async function updateMember(ctx: AuthContext, membershipId: string, input: unknown) {
  const data = memberUpdateSchema.parse(input);

  const membership = await ctx.db.membership.findFirst({ where: { id: membershipId } });
  if (!membership) throw new NotFoundError("Collaborateur");

  if (membership.userId === ctx.user.id) {
    throw new ForbiddenError(
      "Modification de ses propres droits",
      "Vous ne pouvez pas modifier vos propres droits. Demandez-le à un autre administrateur.",
    );
  }
  if (membership.role === "client") {
    throw new ValidationError("Un compte client se gère depuis son dossier, pas depuis l'équipe.");
  }
  if (membership.role === "owner") {
    throw new ForbiddenError(
      "Rétrogradation du propriétaire",
      "Le rôle propriétaire ne se retire pas ici : transmettez-le d'abord.",
    );
  }

  const updated = await ctx.db.membership.update({
    where: { id: membershipId },
    data: { role: data.role, restrictedToAssigned: data.restrictedToAssigned },
  });

  await recordAudit({
    action: "member.updated",
    cabinetId: ctx.cabinet.id,
    userId: ctx.user.id,
    resourceType: "Membership",
    resourceId: membershipId,
    metadata: {
      from: { role: membership.role, restrictedToAssigned: membership.restrictedToAssigned },
      to: { role: data.role, restrictedToAssigned: data.restrictedToAssigned },
    },
    ip: ctx.ip,
  });

  return updated;
}

/** Retire un collaborateur du cabinet. Le compte utilisateur n'est pas supprimé. */
export async function removeMember(ctx: AuthContext, membershipId: string) {
  const membership = await ctx.db.membership.findFirst({ where: { id: membershipId } });
  if (!membership) throw new NotFoundError("Collaborateur");

  if (membership.userId === ctx.user.id) {
    throw new ForbiddenError(
      "Retrait de soi-même",
      "Vous ne pouvez pas vous retirer vous-même du cabinet.",
    );
  }
  if (membership.role === "owner") {
    const owners = await ctx.db.membership.count({ where: { role: "owner", status: "active" } });
    if (owners <= 1) {
      throw new ForbiddenError(
        "Dernier propriétaire",
        "Le cabinet doit garder au moins un propriétaire.",
      );
    }
  }

  await ctx.db.membership.update({ where: { id: membershipId }, data: { status: "revoked" } });

  await recordAudit({
    action: "member.removed",
    cabinetId: ctx.cabinet.id,
    userId: ctx.user.id,
    resourceType: "Membership",
    resourceId: membershipId,
    metadata: { role: membership.role },
    ip: ctx.ip,
  });
}

/** Invitation lisible depuis son jeton, pour l'écran d'acceptation. */
export async function readInvitation(token: string) {
  const invitation = await platformDb.invitation.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { cabinet: { select: { name: true } } },
  });
  if (!invitation) return null;
  if (invitation.acceptedAt) return null;
  if (invitation.expiresAt.getTime() < Date.now()) return null;
  return invitation;
}

const acceptSchema = z.object({
  name: z.string().trim().min(2, "Nom requis."),
  password: z.string().min(1, "Mot de passe requis."),
});

/**
 * Accepte une invitation : crée le compte s'il n'existe pas, puis le rattache au
 * cabinet avec le rôle prévu. Non authentifiée par nature — le jeton fait foi,
 * et il est consommé, donc un lien ne sert qu'une fois.
 */
export async function acceptInvitation(
  token: string,
  input: unknown,
  meta: { ip?: string | null; userAgent?: string | null } = {},
) {
  const data = acceptSchema.parse(input);
  const invitation = await readInvitation(token);
  if (!invitation) {
    throw new ValidationError("Cette invitation n'est plus valable. Demandez-en une nouvelle.");
  }

  assertPasswordPolicy(data.password);
  const passwordHash = await hashPassword(data.password);

  const result = await platformDb.$transaction(async (tx) => {
    let user = await tx.user.findUnique({ where: { email: invitation.email } });
    if (!user) {
      user = await tx.user.create({
        data: { email: invitation.email, name: data.name, passwordHash },
      });
    }

    const existing = await tx.membership.findFirst({
      where: { cabinetId: invitation.cabinetId, userId: user.id },
    });
    if (existing) {
      await tx.membership.update({
        where: { id: existing.id },
        data: { role: invitation.role, status: "active" },
      });
    } else {
      await tx.membership.create({
        data: { userId: user.id, cabinetId: invitation.cabinetId, role: invitation.role },
      });
    }

    // Le jeton est consommé : le lien ne peut pas resservir.
    await tx.invitation.update({
      where: { id: invitation.id },
      data: { acceptedAt: new Date() },
    });

    return user;
  });

  await recordAudit({
    action: "member.joined",
    cabinetId: invitation.cabinetId,
    userId: result.id,
    resourceType: "Membership",
    metadata: { role: invitation.role },
    ip: meta.ip ?? null,
    userAgent: meta.userAgent ?? null,
  });

  return { user: result, cabinetId: invitation.cabinetId, role: invitation.role };
}

/** Collaborateurs assignés à un dossier, avec leur nom. */
export async function listClientAssignees(ctx: AuthContext, clientId: string) {
  const assignments = await ctx.db.clientAssignment.findMany({ where: { clientId } });
  const users = await platformDb.user.findMany({
    where: { id: { in: assignments.map((a) => a.userId) } },
    select: { id: true, name: true, email: true },
  });
  const byId = new Map(users.map((user) => [user.id, user]));
  return assignments.map((assignment) => ({
    userId: assignment.userId,
    role: assignment.role,
    name: byId.get(assignment.userId)?.name ?? "—",
    email: byId.get(assignment.userId)?.email ?? "—",
  }));
}

/** Retire un collaborateur d'un dossier. */
export async function unassignCollaborator(ctx: AuthContext, clientId: string, userId: string) {
  const { count } = await ctx.db.clientAssignment.deleteMany({ where: { clientId, userId } });
  if (count === 0) throw new NotFoundError("Assignation");

  await recordAudit({
    action: "client.unassigned",
    cabinetId: ctx.cabinet.id,
    userId: ctx.user.id,
    resourceType: "Client",
    resourceId: clientId,
    metadata: { unassignedFrom: userId },
    ip: ctx.ip,
  });
}

/**
 * Réglages du cabinet.
 *
 * `cndpMode` n'est pas un réglage d'affichage : en « autorisation », le numéro
 * de CIN des gérants devient enregistrable (loi 09-08, art. 12-1-e). Le passage
 * est donc journalisé, et la référence du dossier CNDP est demandée avec.
 */
export async function updateCabinetSettings(ctx: AuthContext, input: unknown) {
  const data = cabinetSettingsSchema.parse(input);

  if (data.cndpMode === "authorization" && !data.cndpRef) {
    throw new ValidationError(
      "Renseignez la référence de votre autorisation CNDP avant d'activer ce mode.",
    );
  }

  const before = await ctx.db.cabinet.findFirst({ where: { id: ctx.cabinet.id } });
  const updated = await ctx.db.cabinet.update({
    where: { id: ctx.cabinet.id },
    data,
  });

  await recordAudit({
    action: "cabinet.settings_updated",
    cabinetId: ctx.cabinet.id,
    userId: ctx.user.id,
    resourceType: "Cabinet",
    resourceId: ctx.cabinet.id,
    metadata: {
      cndpModeFrom: before?.cndpMode ?? null,
      cndpModeTo: data.cndpMode,
    },
    ip: ctx.ip,
  });

  return updated;
}

/**
 * Collaborateurs, au format des sélecteurs.
 *
 * Distinct de `listMembers`, qui alimente la section Équipe et demande
 * `member.view` : savoir qui compose son cabinet n'est pas une donnée
 * d'administration, et un comptable doit pouvoir dire qui reçoit un
 * rendez-vous. L'autorisation est celle de l'écran appelant.
 */
export async function listStaffOptions(ctx: AuthContext) {
  const memberships = await ctx.db.membership.findMany({
    where: { status: "active", role: { not: "client" } },
    select: { userId: true },
  });
  const users = await platformDb.user.findMany({
    where: { id: { in: memberships.map((m) => m.userId) } },
    select: { id: true, name: true, email: true },
    orderBy: { name: "asc" },
  });

  return users.map((user) => ({
    id: user.id,
    label: user.name,
    hint: user.email,
    searchKey: buildSearchKey(user.name, user.email),
  }));
}

/** Libellés lisibles des actions journalisées, pour l'historique d'un collaborateur. */
const ACTION_LABELS: Record<string, string> = {
  "client.created": "a créé un dossier",
  "client.updated": "a modifié un dossier",
  "client.archived": "a archivé un dossier",
  "client.assigned": "a assigné un dossier",
  "document.uploaded": "a déposé un document",
  "document.downloaded": "a téléchargé un document",
  "document.deleted": "a supprimé un document",
  "document.approved": "a validé un document",
  "document.rejected": "a refusé un document",
  "deadline.generated": "a généré des échéances",
  "deadline.updated": "a mis à jour une échéance",
  "intervention.created": "a enregistré un service rendu",
  "intervention.updated": "a modifié un service rendu",
  "intervention.deleted": "a retiré un service rendu",
  "appointment.created": "a pris un rendez-vous",
  "appointment.updated": "a modifié un rendez-vous",
  "appointment.completed": "a validé un rendez-vous",
  "todo.created": "a confié une tâche",
  "todo.submitted": "a rendu une tâche",
  "todo.approved": "a confirmé une tâche",
  "todo.returned": "a renvoyé une tâche",
  "invoice.created": "a émis une facture",
  "invoice.payment": "a enregistré un règlement",
  "member.invited": "a invité un collaborateur",
  "member.updated": "a modifié un collaborateur",
  "member.removed": "a retiré un collaborateur",
  "auth.login": "s'est connecté",
  "auth.logout": "s'est déconnecté",
};

export function actionLabel(action: string): string {
  return ACTION_LABELS[action] ?? action.replace(/[._]/g, " ");
}

export type MemberActivity = {
  id: string;
  action: string;
  label: string;
  resourceType: string | null;
  resourceId: string | null;
  clientName: string | null;
  outcome: string;
  createdAt: Date;
};

/**
 * Ce qu'un collaborateur a fait sur la plateforme.
 *
 * La source est le journal d'audit, non le fil d'activité : l'audit enregistre
 * **tout**, y compris les modifications, qui sont précisément ce que
 * l'administrateur veut voir. Les noms de dossiers sont résolus à travers le
 * client Prisma du contexte : un dossier hors de sa portée reste anonyme plutôt
 * que de fuir par l'historique.
 */
export async function listMemberActivity(
  ctx: AuthContext,
  userId: string,
  limit = 60,
): Promise<MemberActivity[]> {
  // Le collaborateur doit appartenir au cabinet : l'identifiant vient de l'URL.
  const member = await ctx.db.membership.findFirst({ where: { userId }, select: { id: true } });
  if (!member) throw new NotFoundError("Collaborateur");

  const entries = await ctx.db.auditLog.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  const clientIds = new Set<string>();
  for (const entry of entries) {
    if (entry.resourceType === "Client" && entry.resourceId) clientIds.add(entry.resourceId);
    const target = readClientId(entry.metadata);
    if (target) clientIds.add(target);
  }

  const clients = clientIds.size
    ? await ctx.db.client.findMany({
        where: { id: { in: [...clientIds] } },
        select: { id: true, legalName: true },
      })
    : [];
  const names = new Map(clients.map((client) => [client.id, client.legalName]));

  return entries.map((entry) => {
    const clientId =
      entry.resourceType === "Client" ? entry.resourceId : readClientId(entry.metadata);
    return {
      id: entry.id,
      action: entry.action,
      label: actionLabel(entry.action),
      resourceType: entry.resourceType,
      resourceId: entry.resourceId,
      clientName: clientId ? names.get(clientId) ?? null : null,
      outcome: entry.outcome,
      createdAt: entry.createdAt,
    };
  });
}

/** Le dossier visé, quand l'action l'a noté dans ses métadonnées. */
function readClientId(metadata: string | null): string | null {
  if (!metadata) return null;
  try {
    const parsed: unknown = JSON.parse(metadata);
    if (parsed && typeof parsed === "object" && "clientId" in parsed) {
      const value = (parsed as { clientId?: unknown }).clientId;
      return typeof value === "string" ? value : null;
    }
  } catch {
    return null;
  }
  return null;
}
