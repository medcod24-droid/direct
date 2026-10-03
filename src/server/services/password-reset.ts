import { createHash, randomBytes } from "node:crypto";
import { recordAudit } from "@/lib/audit";
import { assertPasswordPolicy, hashPassword } from "@/lib/auth/password";
import { platformDb } from "@/lib/db/tenant";
import { env } from "@/lib/env";
import { ValidationError } from "@/lib/errors";
import { sendMail } from "@/lib/mail/send";
import { motDePasseChange, reinitialisationMotDePasse } from "@/lib/mail/templates";
import { forgotPasswordSchema, resetPasswordSchema } from "@/lib/validation/schemas";

/**
 * Mot de passe oublié.
 *
 * Trois règles tiennent ce fichier :
 * - **la réponse ne dit jamais si l'adresse existe.** L'écran affiche le même
 *   message dans tous les cas ; sans cela, le formulaire devenait un moyen de
 *   savoir qui travaille dans quel cabinet ;
 * - **le jeton ne vit qu'une heure et ne sert qu'une fois**, et seule son
 *   empreinte est stockée — comme pour les sessions, le courriel est le seul
 *   endroit où il existe en clair ;
 * - **changer le mot de passe ferme toutes les sessions.** Si quelqu'un d'autre
 *   était entré, il est dehors au moment même où le mot de passe change.
 */
const TTL_MINUTES = 60;
/** Au-delà, c'est un formulaire qu'on secoue : les demandes suivantes sont ignorées. */
const MAX_DEMANDES_PAR_HEURE = 5;

function empreinte(token: string): string {
  return createHash("sha256").update(token + env().APP_SECRET).digest("hex");
}

export async function requestPasswordReset(
  input: unknown,
  meta: { ip?: string | null; userAgent?: string | null } = {},
) {
  const { email } = forgotPasswordSchema.parse(input);
  const user = await platformDb.user.findUnique({ where: { email } });

  if (!user || !user.isActive) {
    await recordAudit({
      action: "auth.password_reset_requested",
      metadata: { email, reason: "compte inconnu" },
      ip: meta.ip,
      userAgent: meta.userAgent,
      outcome: "denied",
    });
    return;
  }

  const recentes = await platformDb.passwordReset.count({
    where: { userId: user.id, createdAt: { gt: new Date(Date.now() - 3600_000) } },
  });
  if (recentes >= MAX_DEMANDES_PAR_HEURE) {
    await recordAudit({
      action: "auth.password_reset_requested",
      userId: user.id,
      metadata: { reason: "trop de demandes" },
      ip: meta.ip,
      userAgent: meta.userAgent,
      outcome: "denied",
    });
    return;
  }

  const token = randomBytes(32).toString("base64url");
  await platformDb.passwordReset.create({
    data: {
      userId: user.id,
      tokenHash: empreinte(token),
      expiresAt: new Date(Date.now() + TTL_MINUTES * 60_000),
      ip: meta.ip ?? null,
      userAgent: meta.userAgent?.slice(0, 300) ?? null,
    },
  });

  await sendMail(
    reinitialisationMotDePasse({
      nom: user.name,
      email: user.email,
      lien: `${env().APP_URL}/mot-de-passe/reinitialiser?jeton=${token}`,
      minutes: TTL_MINUTES,
    }),
  );

  await recordAudit({
    action: "auth.password_reset_requested",
    userId: user.id,
    ip: meta.ip,
    userAgent: meta.userAgent,
  });
}

export async function resetPassword(
  input: unknown,
  meta: { ip?: string | null; userAgent?: string | null } = {},
) {
  const data = resetPasswordSchema.parse(input);
  const demande = await platformDb.passwordReset.findUnique({
    where: { tokenHash: empreinte(data.token) },
    include: { user: true },
  });

  // Même message pour un jeton inconnu, expiré ou déjà utilisé : il n'y a rien à
  // apprendre de la différence, et l'écran propose de redemander un lien.
  const perime =
    !demande ||
    demande.usedAt !== null ||
    demande.expiresAt.getTime() < Date.now() ||
    !demande.user.isActive;
  if (perime) {
    await recordAudit({
      action: "auth.password_reset_failed",
      userId: demande?.userId,
      ip: meta.ip,
      userAgent: meta.userAgent,
      outcome: "denied",
    });
    throw new ValidationError(
      "Ce lien n'est plus valable. Demandez-en un nouveau depuis « Mot de passe oublié ».",
    );
  }

  assertPasswordPolicy(data.password, demande.user.email);
  const passwordHash = await hashPassword(data.password);

  await platformDb.$transaction([
    platformDb.user.update({
      where: { id: demande.userId },
      data: { passwordHash, failedLoginAttempts: 0, lockedUntil: null },
    }),
    platformDb.passwordReset.update({ where: { id: demande.id }, data: { usedAt: new Date() } }),
    // Les autres demandes en cours tombent avec celle-ci : un deuxième courriel
    // reçu entre-temps ne doit pas rouvrir la porte.
    platformDb.passwordReset.deleteMany({ where: { userId: demande.userId, usedAt: null } }),
    platformDb.session.deleteMany({ where: { userId: demande.userId } }),
  ]);

  await recordAudit({
    action: "auth.password_reset",
    userId: demande.userId,
    ip: meta.ip,
    userAgent: meta.userAgent,
  });

  await sendMail(
    motDePasseChange({
      nom: demande.user.name,
      email: demande.user.email,
      lienConnexion: `${env().APP_URL}/login`,
    }),
  );

  return { email: demande.user.email };
}
