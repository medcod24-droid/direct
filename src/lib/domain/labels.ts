import { deadlineStatus } from "@/lib/deadlines/engine";

/** Libellés métier partagés par l'interface. Aucun libellé n'est réécrit dans les pages. */

export const SUBTYPE_LABELS: Record<string, string> = {
  sarl: "SARL",
  sarl_au: "SARL AU",
  sa: "SA",
  sas: "SAS",
  snc: "SNC",
  succursale: "Succursale",
  gie: "GIE",
  association: "Association",
  cooperative: "Coopérative",
  syndic: "Syndic de copropriété",
  auto_entrepreneur: "Auto-entrepreneur",
  cpu: "CPU",
  rnr: "IR — RNR",
  rns: "IR — RNS",
  particulier: "Particulier",
};

export const VAT_REGIME_LABELS: Record<string, string> = {
  monthly: "Mensuel",
  quarterly: "Trimestriel",
  exempt: "Hors champ",
};

export const MANAGED_BY_LABELS: Record<string, string> = {
  cabinet: "Cabinet",
  client: "Client",
  third_party: "Tiers",
};

export const ROLE_LABELS: Record<string, string> = {
  owner: "Gérant",
  admin: "Administrateur",
  accountant: "Comptable",
  assistant: "Assistant",
  client: "Accès client",
};

export function subtypeLabel(subtype: string): string {
  return SUBTYPE_LABELS[subtype] ?? subtype;
}

/**
 * Statut affiché d'une échéance.
 *
 * Le statut stocké ne bouge pas tout seul : une échéance « à venir » dont la date est passée
 * est en réalité en retard. L'affichage dérive donc le statut de la date, exactement comme le
 * calcul de santé du dossier, pour que les deux ne se contredisent jamais à l'écran.
 */
export function effectiveDeadlineStatus(deadline: {
  status: string;
  dueDate: Date;
  managedBy?: string;
}): string {
  const derived = deadlineStatus({ status: deadline.status, dueDate: deadline.dueDate });
  if (derived === "overdue") return "overdue";
  if (derived === "not_applicable") return "not_applicable";
  if (deadline.status === "paid") return "paid";
  if (deadline.status === "declared") return "declared";
  return deadline.status;
}

export const PRIORITY_LABELS: Record<string, string> = {
  low: "Basse",
  normal: "Normale",
  high: "Haute",
  urgent: "Urgente",
};

/**
 * Ordre d'affichage des tâches. Le rang est décroissant : une tâche urgente
 * passe devant, quelle que soit son échéance — c'est tout l'intérêt de la marquer.
 */
export const PRIORITY_RANK: Record<string, number> = {
  urgent: 0,
  high: 1,
  normal: 2,
  low: 3,
};
