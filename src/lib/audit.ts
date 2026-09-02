import { platformDb } from "@/lib/db/tenant";

/**
 * Journal d'audit append-only. Écrit avec le client plateforme car il doit fonctionner
 * même quand l'accès est refusé (outcome = "denied"). Aucune opération de mise à jour ou
 * de suppression n'est exposée par l'application.
 *
 * Ne jamais y écrire : contenu de document, mot de passe, jeton, secret.
 */
export type AuditInput = {
  action: string;
  cabinetId?: string | null;
  userId?: string | null;
  resourceType?: string | null;
  resourceId?: string | null;
  metadata?: Record<string, unknown> | null;
  ip?: string | null;
  userAgent?: string | null;
  outcome?: "success" | "denied" | "error";
};

const SENSITIVE_KEYS = /(password|token|secret|authorization|cookie|cin)/i;

function sanitize(metadata?: Record<string, unknown> | null): string | null {
  if (!metadata) return null;
  const clean: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(metadata)) {
    if (SENSITIVE_KEYS.test(key)) continue;
    if (typeof value === "string" && value.length > 500) {
      clean[key] = `${value.slice(0, 500)}…`;
      continue;
    }
    clean[key] = value;
  }
  return JSON.stringify(clean);
}

export async function recordAudit(input: AuditInput): Promise<void> {
  try {
    await platformDb.auditLog.create({
      data: {
        action: input.action,
        cabinetId: input.cabinetId ?? null,
        userId: input.userId ?? null,
        resourceType: input.resourceType ?? null,
        resourceId: input.resourceId ?? null,
        metadata: sanitize(input.metadata),
        ip: input.ip ?? null,
        userAgent: input.userAgent?.slice(0, 300) ?? null,
        outcome: input.outcome ?? "success",
      },
    });
  } catch (error) {
    // Le journal ne doit jamais faire échouer l'action métier, mais l'incident est tracé.
    console.error("[audit] écriture impossible", { action: input.action, error });
  }
}
