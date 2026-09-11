import { recordAudit } from "@/lib/audit";
import { assertPasswordPolicy, hashPassword } from "@/lib/auth/password";
import type { AuthContext } from "@/lib/authz/guard";
import {
  GRANTABLE,
  effectivePermissions,
  isAdjustableRole,
  isGrantable,
  normalizePermissions,
  permissionLabel,
  presetPermissions,
  readGranted,
  storedPermissions,
  type AdjustableRole,
  type Permission,
} from "@/lib/authz/permissions";
import { assertWithinLimit } from "@/lib/billing/entitlements";
import { platformDb } from "@/lib/db/tenant";
import type { Role } from "@/lib/domain/enums";
import { ForbiddenError, NotFoundError, ValidationError } from "@/lib/errors";
import { buildSearchKey } from "@/lib/search";
import {
  addMemberSchema,
  cabinetSettingsSchema,
  memberRightsSchema,
  type MemberRights,
} from "@/lib/validation/schemas";

/**
 * Équipe du cabinet : collaborateurs, droits et portée d'accès.
 *
 * Quatre règles tiennent tout le fichier :
 * - le rôle « propriétaire » ne s'attribue pas et ne se retire jamais au dernier
 *   qui le porte, sinon le cabinet devient ingérable ;
 * - personne ne modifie ses propres droits, sinon un administrateur pourrait se
 *   verrouiller ou s'élever seul ;
 * - on n'accorde que ce qu'on détient soi-même : un collaborateur à qui l'on a
 *   confié l'équipe ne peut pas fabriquer un compte plus puissant que le sien ;
 * - on ne touche pas à qui détient plus que soi, pour la même raison en sens
 *   inverse — sans quoi il suffirait de rétrograder l'administrateur.
 */

export type TeamMember = {
  membershipId: string;
  userId: string;
  name: string;
  email: string;
  role: Role;
  /** Nom du rôle « Autre ». */
  roleLabel: string | null;
  /** Droits cochables effectivement détenus, dans l'ordre de la grille. */
  permissions: Permission[];
  /** Rôle modèle dont l'administration a ajusté les cases. */
  adjusted: boolean;
  restrictedToAssigned: boolean;
  lastLoginAt: Date | null;
  isSelf: boolean;
};

/** Ce que la grille de droits reçoit pour un collaborateur réglable. */
export type EditableMember = {
  membershipId: string;
  name: string;
  role: AdjustableRole;
  roleLabel: string | null;
  permissions: Permission[];
  restrictedToAssigned: boolean;
};

/** Le collaborateur au format de la grille, ou `null` s'il n'a pas de droits réglables. */
export function editableMember(member: TeamMember): EditableMember | null {
  if (!isAdjustableRole(member.role)) return null;
  return {
    membershipId: member.membershipId,
    name: member.name,
    role: member.role,
    roleLabel: member.roleLabel,
    permissions: member.permissions,
    restrictedToAssigned: member.restrictedToAssigned,
  };
}

type MembershipRights = { role: string; permissions: string | null };

/** Droits cochables détenus par une adhésion. */
function grantedOf(membership: MembershipRights): Permission[] {
  const effective = effectivePermissions(membership.role as Role, readGranted(membership.permissions));
  return GRANTABLE.filter((permission) => effective.has(permission));
}

/**
 * Droits demandés, contrôlés contre ceux de la personne qui les accorde.
 * Renvoie ce qu'il faut enregistrer et la sélection normalisée.
 */
function resolveRights(ctx: AuthContext, data: MemberRights) {
  const unknown = (data.permissions ?? []).filter((permission) => !isGrantable(permission));
  if (unknown.length > 0) {
    throw new ValidationError(`Droit inconnu : ${unknown.join(", ")}.`);
  }

  const selection = data.permissions
    ? normalizePermissions(data.permissions)
    : presetPermissions(data.role);

  const beyond = selection.filter((permission) => !ctx.can(permission));
  if (beyond.length > 0) {
    throw new ForbiddenError(
      "Élévation de droits",
      `Vous ne pouvez pas accorder un droit que vous n'avez pas vous-même : ${beyond
        .map(permissionLabel)
        .join(", ")}.`,
    );
  }

  return {
    role: data.role,
    roleLabel: data.role === "custom" ? (data.roleLabel ?? "").trim() : null,
    permissions: storedPermissions(data.role, selection),
    selection,
  };
}

/** Refuse d'agir sur un collaborateur qui détient des droits qu'on n'a pas. */
function assertNotBetterEndowed(ctx: AuthContext, membership: MembershipRights) {
  const beyond = grantedOf(membership).filter((permission) => !ctx.can(permission));
  if (beyond.length > 0) {
    throw new ForbiddenError(
      "Collaborateur mieux doté",
      "Ce collaborateur détient des droits que vous n'avez pas : seul quelqu'un qui les détient peut modifier son accès.",
    );
  }
}

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
      roleLabel: membership.roleLabel,
      permissions: grantedOf(membership),
      adjusted:
        membership.role !== "custom" &&
        isAdjustableRole(membership.role) &&
        readGranted(membership.permissions) !== null,
      restrictedToAssigned: membership.restrictedToAssigned,
      lastLoginAt: user?.lastLoginAt ?? null,
      isSelf: membership.userId === ctx.user.id,
    };
  });
}

export async function addMember(ctx: AuthContext, input: unknown) {
  const data = addMemberSchema.parse(input);
  const rights = resolveRights(ctx, data);
  await assertWithinLimit(ctx.cabinet.id, "users");
  assertPasswordPolicy(data.password, data.email);

  const existing = await platformDb.user.findUnique({ where: { email: data.email } });
  if (existing) {
    const already = await platformDb.membership.findFirst({
      where: { cabinetId: ctx.cabinet.id, userId: existing.id },
    });
    if (already) {
      // Un collaborateur retiré revient : on réactive plutôt que de créer un doublon.
      if (already.status !== "active") {
        await platformDb.membership.update({
          where: { id: already.id },
          data: {
            status: "active",
            role: rights.role,
            roleLabel: rights.roleLabel,
            permissions: rights.permissions,
            restrictedToAssigned: data.restrictedToAssigned,
          },
        });
        return { user: existing, created: false };
      }
      throw new ValidationError("Cette personne fait déjà partie du cabinet.");
    }
  }

  // Un compte existant garde son mot de passe : il appartient à la personne, pas
  // au cabinet, et une adresse peut servir dans plusieurs cabinets.
  const user =
    existing ??
    (await platformDb.user.create({
      data: {
        email: data.email,
        name: data.name,
        passwordHash: await hashPassword(data.password),
      },
    }));

  await platformDb.membership.create({
    data: {
      userId: user.id,
      cabinetId: ctx.cabinet.id,
      role: rights.role,
      roleLabel: rights.roleLabel,
      permissions: rights.permissions,
      restrictedToAssigned: data.restrictedToAssigned,
    },
  });

  await recordAudit({
    action: "member.added",
    cabinetId: ctx.cabinet.id,
    userId: ctx.user.id,
    resourceType: "User",
    resourceId: user.id,
    metadata: {
      email: data.email,
      role: rights.role,
      roleLabel: rights.roleLabel,
      permissions: rights.selection,
      reusedAccount: Boolean(existing),
    },
    ip: ctx.ip,
    userAgent: ctx.userAgent,
  });

  return { user, created: !existing };
}

/** Modifie le rôle, les droits et la portée d'un collaborateur. */
export async function updateMember(ctx: AuthContext, membershipId: string, input: unknown) {
  const data = memberRightsSchema.parse(input);

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
  assertNotBetterEndowed(ctx, membership);

  const rights = resolveRights(ctx, data);
  const before = grantedOf(membership);

  const updated = await ctx.db.membership.update({
    where: { id: membershipId },
    data: {
      role: rights.role,
      roleLabel: rights.roleLabel,
      permissions: rights.permissions,
      restrictedToAssigned: data.restrictedToAssigned,
    },
  });

  // Le journal garde le détail des cases, pas seulement le nom du rôle : c'est
  // la question qu'on se pose après coup — « depuis quand peut-il supprimer ? ».
  await recordAudit({
    action: "member.updated",
    cabinetId: ctx.cabinet.id,
    userId: ctx.user.id,
    resourceType: "Membership",
    resourceId: membershipId,
    metadata: {
      from: {
        role: membership.role,
        roleLabel: membership.roleLabel,
        restrictedToAssigned: membership.restrictedToAssigned,
      },
      to: {
        role: rights.role,
        roleLabel: rights.roleLabel,
        restrictedToAssigned: data.restrictedToAssigned,
      },
      granted: rights.selection.filter((permission) => !before.includes(permission)),
      revoked: before.filter((permission) => !rights.selection.includes(permission)),
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
  assertNotBetterEndowed(ctx, membership);

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
  "member.added": "a ajouté un collaborateur",
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
