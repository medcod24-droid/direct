import { z } from "zod";
import { recordAudit } from "@/lib/audit";
import { assertPasswordPolicy, hashPassword } from "@/lib/auth/password";
import { hashToken, newToken } from "@/lib/auth/session";
import type { AuthContext } from "@/lib/authz/guard";
import { assertWithinLimit } from "@/lib/billing/entitlements";
import { platformDb } from "@/lib/db/tenant";
import type { Role } from "@/lib/domain/enums";
import { ForbiddenError, NotFoundError, ValidationError } from "@/lib/errors";
import { inviteSchema } from "@/lib/validation/schemas";

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
  const memberships = await ctx.db.membership.findMany({ orderBy: { createdAt: "asc" } });
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
