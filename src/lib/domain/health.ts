import type { Health } from "@/lib/domain/enums";

/**
 * Santé d'un dossier client.
 *
 * Le calcul est volontairement explicite et vérifiable : chaque couleur s'explique par
 * des faits datés que le gérant peut vérifier lui-même. Pas de score opaque.
 * Les obligations gérées par le client ou par un tiers ne comptent jamais en rouge
 * pour le cabinet.
 */
export type HealthInput = {
  overdueDeadlines: number; // échéances dépassées, gérées par le cabinet
  deadlinesDueSoon: number; // échéances à moins de 7 jours sans preuve
  pendingRequestsOverdue: number; // pièces demandées au client, hors délai
  missingRequiredDocuments: number;
  expiredDocuments: number; // attestations et pièces à date de validité dépassée
  overdueInvoices: number; // honoraires impayés au-delà de l'échéance
};

export type HealthResult = {
  status: Health;
  reasons: string[];
};

export function computeHealth(input: HealthInput): HealthResult {
  const reasons: string[] = [];

  if (input.overdueDeadlines > 0)
    reasons.push(`${input.overdueDeadlines} échéance(s) dépassée(s) sans preuve de dépôt`);
  if (input.expiredDocuments > 0)
    reasons.push(`${input.expiredDocuments} document(s) expiré(s)`);
  if (input.overdueInvoices > 0)
    reasons.push(`${input.overdueInvoices} facture(s) d'honoraires en retard`);
  if (input.pendingRequestsOverdue > 0)
    reasons.push(`${input.pendingRequestsOverdue} pièce(s) demandée(s) non reçue(s) dans les délais`);
  if (input.deadlinesDueSoon > 0)
    reasons.push(`${input.deadlinesDueSoon} échéance(s) dans les 7 jours`);
  if (input.missingRequiredDocuments > 0)
    reasons.push(`${input.missingRequiredDocuments} document(s) obligatoire(s) manquant(s)`);

  if (input.overdueDeadlines > 0 || input.expiredDocuments > 0) {
    return { status: "red", reasons };
  }
  if (
    input.pendingRequestsOverdue > 0 ||
    input.deadlinesDueSoon > 0 ||
    input.missingRequiredDocuments > 0 ||
    input.overdueInvoices > 0
  ) {
    return { status: "amber", reasons };
  }
  return { status: "green", reasons: ["Aucun retard connu"] };
}
