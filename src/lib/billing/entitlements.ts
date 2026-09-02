import { platformDb } from "@/lib/db/tenant";
import { LimitExceededError } from "@/lib/errors";

/**
 * Limites d'usage. Elles sont lues côté serveur depuis le plan rattaché à l'abonnement :
 * aucune limite n'est envoyée au client ni acceptée depuis lui.
 */
export type Usage = {
  clients: number;
  users: number;
  storageMb: number;
  monthlyUploads: number;
};

export type Entitlements = {
  planCode: string;
  planName: string;
  status: string;
  trialEndsAt: Date | null;
  limits: {
    maxClients: number | null;
    maxUsers: number | null;
    maxStorageMb: number | null;
    maxMonthlyUploads: number | null;
  };
  features: string[];
  usage: Usage;
};

export async function getEntitlements(cabinetId: string): Promise<Entitlements> {
  const subscription = await platformDb.subscription.findUnique({
    where: { cabinetId },
    include: { plan: true },
  });
  if (!subscription) throw new LimitExceededError("Aucun abonnement actif pour ce cabinet.");

  const monthStart = new Date();
  monthStart.setUTCDate(1);
  monthStart.setUTCHours(0, 0, 0, 0);

  const [clients, users, uploads, cabinet] = await Promise.all([
    platformDb.client.count({ where: { cabinetId, status: { not: "archived" } } }),
    platformDb.membership.count({
      where: { cabinetId, status: "active", role: { not: "client" } },
    }),
    platformDb.document.count({ where: { cabinetId, createdAt: { gte: monthStart } } }),
    platformDb.cabinet.findUnique({ where: { id: cabinetId }, select: { storageUsed: true } }),
  ]);

  return {
    planCode: subscription.plan.code,
    planName: subscription.plan.name,
    status: subscription.status,
    trialEndsAt: subscription.trialEndsAt,
    limits: {
      maxClients: subscription.plan.maxClients,
      maxUsers: subscription.plan.maxUsers,
      maxStorageMb: subscription.plan.maxStorageMb,
      maxMonthlyUploads: subscription.plan.maxMonthlyUploads,
    },
    features: JSON.parse(subscription.plan.features) as string[],
    usage: {
      clients,
      users,
      storageMb: Math.round(((cabinet?.storageUsed ?? 0) / (1024 * 1024)) * 10) / 10,
      monthlyUploads: uploads,
    },
  };
}

export function isSubscriptionUsable(status: string, trialEndsAt: Date | null): boolean {
  if (status === "active") return true;
  if (status === "trialing") return !trialEndsAt || trialEndsAt.getTime() > Date.now();
  return false;
}

/** Vérifie une limite avant création. Lève une erreur explicite, jamais un 500. */
export async function assertWithinLimit(
  cabinetId: string,
  metric: "clients" | "users" | "storageMb" | "monthlyUploads",
  increment = 1,
): Promise<Entitlements> {
  const entitlements = await getEntitlements(cabinetId);

  if (!isSubscriptionUsable(entitlements.status, entitlements.trialEndsAt)) {
    throw new LimitExceededError(
      "Votre abonnement n'est plus actif. Renouvelez-le pour continuer à ajouter des éléments.",
    );
  }

  const limitKey = {
    clients: "maxClients",
    users: "maxUsers",
    storageMb: "maxStorageMb",
    monthlyUploads: "maxMonthlyUploads",
  } as const;

  const limit = entitlements.limits[limitKey[metric]];
  if (limit === null) return entitlements;

  const current = entitlements.usage[metric];
  if (current + increment > limit) {
    const labels = {
      clients: `dossiers clients (${current}/${limit})`,
      users: `utilisateurs (${current}/${limit})`,
      storageMb: `stockage (${current} Mo/${limit} Mo)`,
      monthlyUploads: `documents ce mois (${current}/${limit})`,
    };
    throw new LimitExceededError(
      `Limite du plan ${entitlements.planName} atteinte : ${labels[metric]}. Changez de plan pour continuer.`,
    );
  }
  return entitlements;
}

/** Seuil d'avertissement affiché à l'administrateur (80 % d'une limite). */
export function usageWarnings(entitlements: Entitlements): string[] {
  const warnings: string[] = [];
  const check = (label: string, used: number, limit: number | null) => {
    if (limit && used / limit >= 0.8) warnings.push(`${label} : ${used}/${limit}`);
  };
  check("Dossiers clients", entitlements.usage.clients, entitlements.limits.maxClients);
  check("Utilisateurs", entitlements.usage.users, entitlements.limits.maxUsers);
  check("Stockage (Mo)", entitlements.usage.storageMb, entitlements.limits.maxStorageMb);
  return warnings;
}
