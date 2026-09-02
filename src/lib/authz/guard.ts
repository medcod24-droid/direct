import { cookies, headers } from "next/headers";
import { readSession, SESSION_COOKIE } from "@/lib/auth/session";
import { can, isStaffRole, type Permission } from "@/lib/authz/permissions";
import { platformDb, tenantDb, type TenantClient, type TenantScope } from "@/lib/db/tenant";
import type { Role } from "@/lib/domain/enums";
import { ForbiddenError, NotFoundError, UnauthenticatedError } from "@/lib/errors";
import { recordAudit } from "@/lib/audit";

/**
 * Contexte d'exécution d'une requête authentifiée.
 * `db` est déjà restreint au cabinet et, si nécessaire, aux dossiers autorisés :
 * il n'existe aucun chemin où du code métier reçoit un client Prisma non filtré.
 */
export type AuthContext = {
  sessionId: string;
  user: { id: string; email: string; name: string; locale: string };
  cabinet: { id: string; name: string; slug: string; cndpMode: string };
  membership: { id: string; role: Role; restrictedToAssigned: boolean; clientId: string | null };
  scope: TenantScope;
  db: TenantClient;
  ip: string | null;
  userAgent: string | null;
  can: (permission: Permission) => boolean;
};

async function requestMeta() {
  try {
    const h = await headers();
    const forwarded = h.get("x-forwarded-for");
    return {
      ip: forwarded ? (forwarded.split(",")[0]?.trim() ?? null) : h.get("x-real-ip"),
      userAgent: h.get("user-agent"),
    };
  } catch {
    return { ip: null, userAgent: null };
  }
}

async function currentToken(): Promise<string | undefined> {
  const store = await cookies();
  return store.get(SESSION_COOKIE)?.value;
}

/**
 * Calcule la portée d'accès aux dossiers.
 * - compte client : uniquement son dossier ;
 * - collaborateur restreint : uniquement ses dossiers assignés ;
 * - sinon : tous les dossiers du cabinet.
 */
export async function resolveClientScope(
  cabinetId: string,
  membership: { id: string; role: Role; restrictedToAssigned: boolean; clientId: string | null; userId: string },
): Promise<string[] | null> {
  if (membership.role === "client") return membership.clientId ? [membership.clientId] : [];
  if (!membership.restrictedToAssigned) return null;
  const assignments = await platformDb.clientAssignment.findMany({
    where: { cabinetId, userId: membership.userId },
    select: { clientId: true },
  });
  return assignments.map((a) => a.clientId);
}

/** Contexte courant, ou null si la session est absente/expirée. */
export async function getAuthContext(): Promise<AuthContext | null> {
  const session = await readSession(await currentToken());
  if (!session) return null;

  const membership = session.cabinetId
    ? await platformDb.membership.findFirst({
        where: { userId: session.userId, cabinetId: session.cabinetId, status: "active" },
        include: { cabinet: true },
      })
    : await platformDb.membership.findFirst({
        where: { userId: session.userId, status: "active" },
        include: { cabinet: true },
        orderBy: { createdAt: "asc" },
      });

  if (!membership) return null;

  const role = membership.role as Role;
  const clientIds = await resolveClientScope(membership.cabinetId, {
    id: membership.id,
    role,
    restrictedToAssigned: membership.restrictedToAssigned,
    clientId: membership.clientId,
    userId: session.userId,
  });

  const scope: TenantScope = { cabinetId: membership.cabinetId, clientIds };
  const meta = await requestMeta();

  return {
    sessionId: session.id,
    user: {
      id: session.user.id,
      email: session.user.email,
      name: session.user.name,
      locale: session.user.locale,
    },
    cabinet: {
      id: membership.cabinet.id,
      name: membership.cabinet.name,
      slug: membership.cabinet.slug,
      cndpMode: membership.cabinet.cndpMode,
    },
    membership: {
      id: membership.id,
      role,
      restrictedToAssigned: membership.restrictedToAssigned,
      clientId: membership.clientId,
    },
    scope,
    db: tenantDb(scope),
    ip: meta.ip,
    userAgent: meta.userAgent,
    can: (permission: Permission) => can(role, permission),
  };
}

export async function requireAuth(): Promise<AuthContext> {
  const context = await getAuthContext();
  if (!context) throw new UnauthenticatedError();
  return context;
}

/** Exige une permission. Tout refus est journalisé (outcome = denied). */
export async function requirePermission(permission: Permission): Promise<AuthContext> {
  const context = await requireAuth();
  if (!context.can(permission)) {
    await recordAudit({
      action: "authz.denied",
      cabinetId: context.cabinet.id,
      userId: context.user.id,
      metadata: { permission, role: context.membership.role },
      ip: context.ip,
      userAgent: context.userAgent,
      outcome: "denied",
    });
    throw new ForbiddenError(`Permission ${permission} refusée`);
  }
  return context;
}

/** Exige un accès au personnel du cabinet (exclut les comptes clients du portail). */
export async function requireStaff(permission: Permission): Promise<AuthContext> {
  const context = await requirePermission(permission);
  if (!isStaffRole(context.membership.role)) throw new ForbiddenError("Accès réservé au cabinet");
  return context;
}

export async function requirePortal(): Promise<AuthContext & { clientId: string }> {
  const context = await requirePermission("portal.access");
  const clientId = context.membership.clientId;
  if (!clientId) throw new ForbiddenError("Ce compte n'est rattaché à aucun dossier");
  return { ...context, clientId };
}

/**
 * Vérifie qu'un dossier est accessible dans le contexte courant.
 * La requête passe par `context.db` : un dossier d'un autre cabinet est simplement
 * introuvable, même si son identifiant est exact.
 */
export async function requireClient(context: AuthContext, clientId: string) {
  const client = await context.db.client.findFirst({ where: { id: clientId } });
  if (!client) {
    await recordAudit({
      action: "client.access_denied",
      cabinetId: context.cabinet.id,
      userId: context.user.id,
      resourceType: "Client",
      resourceId: clientId,
      ip: context.ip,
      outcome: "denied",
    });
    throw new NotFoundError("Dossier client");
  }
  return client;
}
