import { recordAudit } from "@/lib/audit";
import { assertPasswordPolicy, hashPassword, verifyPassword } from "@/lib/auth/password";
import { createSession } from "@/lib/auth/session";
import { platformDb } from "@/lib/db/tenant";
import { RateLimitError, UnauthenticatedError, ValidationError } from "@/lib/errors";
import { loginSchema, signupSchema } from "@/lib/validation/schemas";

const MAX_ATTEMPTS = 5;
const LOCK_MINUTES = 15;

function slugify(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

/**
 * Inscription d'un cabinet.
 *
 * Le numéro d'inscription à l'ordre (OPCA ou OEC) est exigé : depuis la fin de la période
 * transitoire de la loi 53-19, tenir la comptabilité de tiers sans inscription n'est plus
 * légal. Le numéro est déclaratif à ce stade et devra être vérifié manuellement.
 */
export async function signupCabinet(
  input: unknown,
  meta: { ip?: string | null; userAgent?: string | null } = {},
) {
  const data = signupSchema.parse(input);
  assertPasswordPolicy(data.password, data.email);

  const existing = await platformDb.user.findUnique({ where: { email: data.email } });
  if (existing) {
    // Message neutre : on ne confirme pas l'existence d'un compte.
    throw new ValidationError("Impossible de créer ce compte. Essayez de vous connecter.");
  }

  const plan = await platformDb.plan.findUnique({ where: { code: "professional" } });
  if (!plan) throw new ValidationError("Aucun plan disponible. Contactez le support.");

  const passwordHash = await hashPassword(data.password);
  const base = slugify(data.cabinetName) || "cabinet";
  let slug = base;
  for (let attempt = 1; await platformDb.cabinet.findUnique({ where: { slug } }); attempt += 1) {
    slug = `${base}-${attempt}`;
  }

  const result = await platformDb.$transaction(async (tx) => {
    const cabinet = await tx.cabinet.create({
      data: {
        name: data.cabinetName,
        slug,
        ordre: data.ordre,
        ordreNum: data.ordreNum,
        subscription: {
          create: {
            planId: plan.id,
            status: "trialing",
            trialEndsAt: new Date(Date.now() + 30 * 86400000),
          },
        },
      },
    });

    const user = await tx.user.create({
      data: { email: data.email, name: data.name, passwordHash },
    });

    await tx.membership.create({
      data: { userId: user.id, cabinetId: cabinet.id, role: "owner" },
    });

    return { cabinet, user };
  });

  const { token } = await createSession({
    userId: result.user.id,
    cabinetId: result.cabinet.id,
    ip: meta.ip,
    userAgent: meta.userAgent,
  });

  await recordAudit({
    action: "cabinet.created",
    cabinetId: result.cabinet.id,
    userId: result.user.id,
    resourceType: "Cabinet",
    resourceId: result.cabinet.id,
    metadata: { ordre: data.ordre },
    ip: meta.ip,
    userAgent: meta.userAgent,
  });

  return { token, cabinet: result.cabinet, user: result.user };
}

/**
 * Connexion.
 * Réponse volontairement identique que l'e-mail existe ou non, et verrouillage temporaire
 * après plusieurs échecs pour limiter les attaques par force brute.
 */
export async function login(
  input: unknown,
  meta: { ip?: string | null; userAgent?: string | null } = {},
) {
  const data = loginSchema.parse(input);
  const user = await platformDb.user.findUnique({ where: { email: data.email } });

  if (!user || !user.isActive) {
    await recordAudit({
      action: "auth.login_failed",
      metadata: { email: data.email, reason: "unknown_user" },
      ip: meta.ip,
      userAgent: meta.userAgent,
      outcome: "denied",
    });
    throw new UnauthenticatedError("Identifiants invalides");
  }

  if (user.lockedUntil && user.lockedUntil.getTime() > Date.now()) {
    throw new RateLimitError(
      `Compte temporairement verrouillé après plusieurs échecs. Réessayez dans ${LOCK_MINUTES} minutes.`,
    );
  }

  const valid = await verifyPassword(data.password, user.passwordHash);
  if (!valid) {
    const attempts = user.failedLoginAttempts + 1;
    await platformDb.user.update({
      where: { id: user.id },
      data: {
        failedLoginAttempts: attempts,
        lockedUntil:
          attempts >= MAX_ATTEMPTS ? new Date(Date.now() + LOCK_MINUTES * 60000) : null,
      },
    });
    await recordAudit({
      action: "auth.login_failed",
      userId: user.id,
      metadata: { attempts },
      ip: meta.ip,
      userAgent: meta.userAgent,
      outcome: "denied",
    });
    throw new UnauthenticatedError("Identifiants invalides");
  }

  const membership = await platformDb.membership.findFirst({
    where: { userId: user.id, status: "active" },
    orderBy: { createdAt: "asc" },
  });

  await platformDb.user.update({
    where: { id: user.id },
    data: { failedLoginAttempts: 0, lockedUntil: null, lastLoginAt: new Date() },
  });

  const { token } = await createSession({
    userId: user.id,
    cabinetId: membership?.cabinetId ?? null,
    ip: meta.ip,
    userAgent: meta.userAgent,
  });

  await recordAudit({
    action: "auth.login",
    cabinetId: membership?.cabinetId ?? null,
    userId: user.id,
    ip: meta.ip,
    userAgent: meta.userAgent,
  });

  return { token, user, role: membership?.role ?? null };
}
