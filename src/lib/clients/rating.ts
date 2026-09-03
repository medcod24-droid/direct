/**
 * Note d'un dossier client, de 1 à 5 étoiles.
 *
 * Deux dimensions, volontairement inégales :
 *
 * - **la ponctualité de paiement** (0 à 3 points) — un client qui ne règle pas
 *   coûte de la trésorerie au cabinet, quel que soit son volume ;
 * - **le volume facturé** (0 à 2 points) — mesuré par rapport aux autres dossiers
 *   du cabinet, jamais en dirhams absolus : un « gros dossier » n'a pas le même
 *   montant à Casablanca et à Errachidia, et aucun seuil n'est donc à régler.
 *
 * La ponctualité pèse plus lourd que le volume : un petit dossier qui règle à
 * l'heure passe devant un gros dossier qui traîne. C'est un choix de gestion, pas
 * une évidence — il tient dans les deux constantes ci-dessous.
 *
 * Module pur : aucune base de données, aucune date implicite (`now` est fourni).
 */

export type InvoiceFact = {
  /** Montant HT en centimes de dirham. */
  amount: number;
  paidAmount: number;
  dueDate: Date;
  paidAt: Date | null;
  status: string;
};

export type RatingInput = {
  invoices: InvoiceFact[];
  /**
   * Position du dossier dans le chiffre d'affaires du cabinet, de 0 à 1.
   * `null` quand le cabinet n'a pas encore de quoi comparer.
   */
  volumePercentile: number | null;
  now: Date;
};

export type Stars = 1 | 2 | 3 | 4 | 5;

export type Rating = {
  /** `null` = pas assez d'historique pour juger. Un dossier neuf n'est pas mal noté. */
  stars: Stars | null;
  punctuality: 0 | 1 | 2 | 3;
  volume: 0 | 1 | 2;
  /** Part des factures réglées au plus tard à l'échéance. */
  onTimeRatio: number | null;
  /** Retard moyen des factures réglées en retard, en jours. */
  averageDelayDays: number | null;
  overdueCount: number;
  /** Retard le plus ancien encore ouvert, en jours. */
  worstOverdueDays: number;
  settledCount: number;
  /** Phrases prêtes à afficher, dans l'ordre d'importance. */
  reasons: string[];
};

const DAY = 86400000;

/** En deçà, on préfère ne pas noter plutôt que de noter au hasard. */
const MIN_HISTORY = 2;

/** Part de factures réglées à l'heure ouvrant chaque palier de ponctualité. */
const PUNCTUALITY_STEPS: { min: number; score: 0 | 1 | 2 | 3 }[] = [
  { min: 0.9, score: 3 },
  { min: 0.7, score: 2 },
  { min: 0.4, score: 1 },
  { min: 0, score: 0 },
];

/** Percentile de chiffre d'affaires ouvrant chaque palier de volume. */
const VOLUME_STEPS: { min: number; score: 0 | 1 | 2 }[] = [
  { min: 0.8, score: 2 },
  { min: 0.5, score: 1 },
  { min: 0, score: 0 },
];

/** Au delà de ce retard, un impayé pèse doublement. */
const SEVERE_OVERDUE_DAYS = 60;

function daysBetween(from: Date, to: Date): number {
  return Math.floor((to.getTime() - from.getTime()) / DAY);
}

function isCancelled(invoice: InvoiceFact): boolean {
  return invoice.status === "cancelled";
}

/** Réglée : soldée, quelle que soit la date. */
function isSettled(invoice: InvoiceFact): boolean {
  return invoice.paidAt !== null && invoice.paidAmount >= invoice.amount;
}

/** En souffrance : échue, non soldée, à ce jour. */
function isOverdue(invoice: InvoiceFact, now: Date): boolean {
  return !isSettled(invoice) && invoice.dueDate.getTime() < now.getTime();
}

export function rateClient(input: RatingInput): Rating {
  const invoices = input.invoices.filter((i) => !isCancelled(i));
  const settled = invoices.filter(isSettled);
  const overdue = invoices.filter((i) => isOverdue(i, input.now));

  const onTime = settled.filter((i) => i.paidAt!.getTime() <= i.dueDate.getTime());
  const late = settled.filter((i) => i.paidAt!.getTime() > i.dueDate.getTime());

  const onTimeRatio = settled.length > 0 ? onTime.length / settled.length : null;
  const averageDelayDays =
    late.length > 0
      ? Math.round(late.reduce((sum, i) => sum + daysBetween(i.dueDate, i.paidAt!), 0) / late.length)
      : null;
  const worstOverdueDays = overdue.reduce(
    (worst, i) => Math.max(worst, daysBetween(i.dueDate, input.now)),
    0,
  );

  // Ponctualité : le palier atteint, puis les pénalités d'impayés en cours.
  let punctuality: 0 | 1 | 2 | 3 = 0;
  if (onTimeRatio !== null) {
    punctuality = PUNCTUALITY_STEPS.find((step) => onTimeRatio >= step.min)!.score;
  } else if (overdue.length === 0) {
    punctuality = 3; // aucune facture échue : rien à reprocher
  }
  if (overdue.length > 0) punctuality = Math.max(0, punctuality - 1) as 0 | 1 | 2 | 3;
  if (worstOverdueDays > SEVERE_OVERDUE_DAYS) {
    punctuality = Math.max(0, punctuality - 1) as 0 | 1 | 2 | 3;
  }

  const percentile = input.volumePercentile;
  const volume =
    percentile === null ? 0 : VOLUME_STEPS.find((step) => percentile >= step.min)!.score;

  // Pas d'historique exploitable : on ne note pas plutôt que de mal noter un
  // dossier qui vient d'être pris en charge.
  const judgeable = settled.length >= MIN_HISTORY || overdue.length > 0;

  const reasons: string[] = [];
  if (!judgeable) {
    reasons.push(
      settled.length === 0
        ? "Aucune facture réglée : pas encore d'historique de paiement."
        : "Historique trop court pour noter le dossier.",
    );
  } else {
    if (overdue.length > 0) {
      reasons.push(
        `${overdue.length} facture(s) échue(s) non réglée(s), jusqu'à ${worstOverdueDays} jour(s) de retard.`,
      );
    }
    if (onTimeRatio !== null) {
      reasons.push(
        `${Math.round(onTimeRatio * 100)} % des factures réglées à l'échéance` +
          (averageDelayDays !== null ? `, retard moyen ${averageDelayDays} jour(s).` : "."),
      );
    }
    if (percentile !== null) {
      const label =
        volume === 2 ? "parmi les plus gros dossiers du cabinet"
        : volume === 1 ? "dans la moyenne haute du cabinet"
        : "volume modeste à l'échelle du cabinet";
      reasons.push(`Chiffre d'affaires ${label}.`);
    }
  }

  return {
    stars: judgeable ? (Math.max(1, punctuality + volume) as Stars) : null,
    punctuality,
    volume,
    onTimeRatio,
    averageDelayDays,
    overdueCount: overdue.length,
    worstOverdueDays,
    settledCount: settled.length,
    reasons,
  };
}

/**
 * Percentile d'un montant dans la distribution du cabinet.
 * Renvoie la part des dossiers que celui-ci dépasse, de 0 à 1.
 */
export function volumePercentile(amount: number, allAmounts: number[]): number | null {
  const others = allAmounts.filter((a) => a > 0);
  if (others.length < 2) return null;
  const below = others.filter((a) => a < amount).length;
  // Rang relatif : on divise par `n - 1`, pas par `n`. Avec `n`, le plus gros
  // dossier d'un cabinet de trois plafonnait à 0,67 et le palier haut (0,8)
  // devenait inatteignable — précisément pour les petits cabinets visés.
  return below / (others.length - 1);
}
