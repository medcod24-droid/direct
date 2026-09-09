/** Valeurs métier. SQLite ne supporte pas les enums Prisma : la contrainte est ici. */

export const ROLES = ["owner", "admin", "accountant", "assistant", "client"] as const;
export type Role = (typeof ROLES)[number];

export const CLIENT_KINDS = ["company", "individual"] as const;
export type ClientKind = (typeof CLIENT_KINDS)[number];

export const CLIENT_SUBTYPES = [
  "sarl", "sarl_au", "sa", "sas", "snc", "succursale", "gie",
  "association", "cooperative", "syndic",
  "auto_entrepreneur", "cpu", "rnr", "rns", "particulier", "autre",
] as const;
export type ClientSubtype = (typeof CLIENT_SUBTYPES)[number];

export const COMPANY_SUBTYPES: ClientSubtype[] = [
  "sarl", "sarl_au", "sa", "sas", "snc", "succursale", "gie", "association", "cooperative", "syndic",
];

export const INDIVIDUAL_SUBTYPES: ClientSubtype[] = [
  "auto_entrepreneur", "cpu", "rnr", "rns", "particulier", "autre",
];

/**
 * Formes juridiques admises pour un type de personne.
 *
 * La fiche client se scinde selon `kind` : sans cette contrainte, un dossier
 * pouvait être enregistré en « personne physique » avec la forme « SARL », et
 * l'écran aurait affiché les champs d'une société pour une personne.
 */
export function subtypesFor(kind: ClientKind): ClientSubtype[] {
  return kind === "individual" ? INDIVIDUAL_SUBTYPES : COMPANY_SUBTYPES;
}

/**
 * Usage d'un bien porté par un article d'imposition.
 *
 * La distinction n'est pas décorative : la taxe d'habitation n'abat la valeur
 * locative que pour l'habitation principale (loi 47-06, art. 20), un bien donné
 * en location n'y est pas soumis mais produit des revenus fonciers imposables à
 * l'IR, et le secondaire ne bénéficie d'aucun abattement.
 */
export const PROPERTY_USAGES = ["principale", "secondaire", "locatif"] as const;
export type PropertyUsage = (typeof PROPERTY_USAGES)[number];

export const VAT_REGIMES = ["monthly", "quarterly", "exempt"] as const;
export type VatRegime = (typeof VAT_REGIMES)[number];

export const TAX_REGIMES = ["is", "rnr", "rns", "cpu", "auto_entrepreneur", "none"] as const;
export type TaxRegime = (typeof TAX_REGIMES)[number];

export const CLIENT_STATUSES = ["prospect", "onboarding", "active", "suspended", "terminated", "archived"] as const;
export type ClientStatus = (typeof CLIENT_STATUSES)[number];

export const ACTIVITY_STATES = ["running", "dormant", "liquidation", "struck_off"] as const;

export const DEADLINE_STATUSES = ["upcoming", "in_progress", "declared", "paid", "overdue", "not_applicable"] as const;
export type DeadlineStatus = (typeof DEADLINE_STATUSES)[number];

export const MANAGED_BY = ["cabinet", "client", "third_party"] as const;
export type ManagedBy = (typeof MANAGED_BY)[number];

export const TASK_STATUSES = ["todo", "in_progress", "waiting_client", "done", "cancelled"] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export const PRIORITIES = ["low", "normal", "high", "urgent"] as const;
export type Priority = (typeof PRIORITIES)[number];

export const REQUEST_STATUSES = ["pending", "submitted", "approved", "rejected", "cancelled"] as const;
export type RequestStatus = (typeof REQUEST_STATUSES)[number];

export const DOCUMENT_STATUSES = ["received", "approved", "rejected", "archived"] as const;

export const INVOICE_STATUSES = ["pending", "partial", "paid", "overdue", "cancelled"] as const;

export const HEALTH = ["green", "amber", "red"] as const;
export type Health = (typeof HEALTH)[number];
