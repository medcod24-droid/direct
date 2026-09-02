import type { ManagedBy } from "@/lib/domain/enums";

/**
 * Moteur d'échéances.
 *
 * Aucune date légale n'est codée en dur dans l'application : chaque obligation est une
 * ligne `DeadlineRule` (condition d'application + formule de date + référence légale +
 * statut de vérification), modifiable par l'administrateur et versionnée par loi de
 * finances. Ce module ne fait que du calcul pur : il est testable sans base de données.
 *
 * Deux pièges métier traités ici, relevés lors de la vérification des textes :
 *  - « avant le 1er X » signifie « au plus tard le dernier jour utile avant le 1er X » ;
 *    « avant l'expiration du mois » signifie le dernier jour du mois ;
 *  - l'exercice social n'est pas toujours l'année civile : les acomptes se calculent à
 *    partir de la date d'ouverture de l'exercice (CGI art. 170).
 */

export type DateFormula =
  /** Date fixe dans l'année. `before: true` = la veille (« avant le 1er avril » = 31 mars). */
  | { kind: "fixed"; month: number; day: number; before?: boolean }
  /** Dernier jour du mois suivant la période (TVA mensuelle télédéclarée). */
  | { kind: "end_of_next_month" }
  /** Dernier jour du premier mois du trimestre suivant (TVA trimestrielle). */
  | { kind: "end_of_first_month_of_next_quarter" }
  /** Jour fixe du mois suivant la période (CNSS : le 10). */
  | { kind: "day_of_next_month"; day: number }
  /** N mois après la clôture de l'exercice (liasse : 3 mois). */
  | { kind: "months_after_fy_end"; months: number }
  /** Fin du N-ième mois suivant l'ouverture de l'exercice (cotisation minimale : 3). */
  | { kind: "end_of_nth_month_after_fy_start"; months: number }
  /**
   * Fin du 3e, 6e, 9e ou 12e mois suivant l'ouverture de l'exercice, selon le trimestre.
   * Les acomptes d'IS se calculent sur l'exercice, pas sur l'année civile (CGI art. 170) :
   * un exercice décalé décale les quatre acomptes.
   */
  | { kind: "end_of_quarter_after_fy_start" };

export type Frequency = "monthly" | "quarterly" | "yearly" | "event";

export type RuleInput = {
  id?: string;
  code: string;
  label: string;
  frequency: Frequency;
  dateFormula: DateFormula;
  appliesTo: AppliesTo;
  managedByDefault?: ManagedBy;
  legalRef?: string | null;
  penaltyFormula?: PenaltyFormula | null;
};

export type AppliesTo = {
  taxRegime?: string[];
  vatRegime?: string[];
  subtype?: string[];
  isEmployer?: boolean;
  minRevenue?: number;
  maxRevenue?: number;
};

export type ClientInput = {
  id: string;
  subtype: string;
  taxRegime: string;
  vatRegime: string;
  isEmployer: boolean;
  referenceRevenue?: number | null;
  fiscalYearEndMonth: number;
  fiscalYearEndDay: number;
  takeoverDate: Date;
  activityState?: string;
};

export type GeneratedDeadline = {
  ruleCode: string;
  ruleId?: string;
  label: string;
  periodLabel: string;
  dueDate: Date;
  managedBy: ManagedBy;
};

const MONTHS_FR = [
  "janvier", "février", "mars", "avril", "mai", "juin",
  "juillet", "août", "septembre", "octobre", "novembre", "décembre",
];

export function utcDate(year: number, month: number, day: number): Date {
  return new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
}

export function lastDayOfMonth(year: number, month: number): Date {
  return new Date(Date.UTC(year, month, 0, 0, 0, 0, 0));
}

function addMonths(year: number, month: number, delta: number): { year: number; month: number } {
  const zero = month - 1 + delta;
  return { year: year + Math.floor(zero / 12), month: ((zero % 12) + 12) % 12 + 1 };
}

/**
 * Ouverture de l'exercice pris en compte pour l'année demandée.
 *
 * On retient l'exercice qui S'OUVRE dans l'année demandée : pour une clôture au
 * 31 décembre, l'exercice 2026 s'ouvre le 1er janvier 2026 et ses quatre acomptes
 * tombent bien en 2026 (CGI art. 170). Pour une clôture décalée au 30 juin, l'exercice
 * ouvert le 1er juillet 2026 porte des acomptes dont deux tombent en 2027.
 */
function fiscalYearStart(year: number, fiscalYearEndMonth: number): { year: number; month: number } {
  return { year, month: (fiscalYearEndMonth % 12) + 1 };
}

/** Vérifie si une règle s'applique à un dossier. Toute condition présente doit passer. */
export function ruleApplies(applies: AppliesTo, client: ClientInput): boolean {
  if (applies.taxRegime?.length && !applies.taxRegime.includes(client.taxRegime)) return false;
  if (applies.vatRegime?.length && !applies.vatRegime.includes(client.vatRegime)) return false;
  if (applies.subtype?.length && !applies.subtype.includes(client.subtype)) return false;
  if (applies.isEmployer !== undefined && applies.isEmployer !== client.isEmployer) return false;
  const revenue = client.referenceRevenue ?? 0;
  if (applies.minRevenue !== undefined && revenue < applies.minRevenue) return false;
  if (applies.maxRevenue !== undefined && revenue > applies.maxRevenue) return false;
  return true;
}

/**
 * Décale une échéance tombant un jour férié ou chômé au premier jour ouvrable suivant
 * (CGI art. 163). Le dimanche est chômé ; le samedi ne l'est pas au sens strict du texte,
 * d'où le paramètre explicite plutôt qu'une hypothèse codée en dur.
 */
export function shiftToBusinessDay(
  date: Date,
  options: { holidays?: Set<string>; saturdayIsHoliday?: boolean } = {},
): Date {
  const holidays = options.holidays ?? new Set<string>();
  const saturdayIsHoliday = options.saturdayIsHoliday ?? false;
  const result = new Date(date.getTime());
  for (let guard = 0; guard < 15; guard += 1) {
    const day = result.getUTCDay();
    const iso = result.toISOString().slice(0, 10);
    const blocked = day === 0 || (saturdayIsHoliday && day === 6) || holidays.has(iso);
    if (!blocked) return result;
    result.setUTCDate(result.getUTCDate() + 1);
  }
  // Quinze jours chômés d'affilée signalent un calendrier de jours fériés erroné :
  // mieux vaut échouer bruyamment que produire une échéance fausse.
  throw new Error(
    `Calendrier de jours fériés incohérent : aucun jour ouvrable trouvé après ${date.toISOString().slice(0, 10)}.`,
  );
}

/** Périodes d'une année civile pour une fréquence donnée. */
export function periodsForYear(frequency: Frequency, year: number): Array<{ index: number; label: string }> {
  switch (frequency) {
    case "monthly":
      return MONTHS_FR.map((name, index) => ({ index: index + 1, label: `${name} ${year}` }));
    case "quarterly":
      return [1, 2, 3, 4].map((quarter) => ({ index: quarter, label: `T${quarter} ${year}` }));
    case "yearly":
      return [{ index: 1, label: String(year) }];
    case "event":
    default:
      return [];
  }
}

/** Date d'échéance brute (avant décalage jour ouvrable). */
export function computeDueDate(
  formula: DateFormula,
  input: { year: number; periodIndex: number; frequency: Frequency; client: ClientInput },
): Date {
  const { year, periodIndex, client } = input;

  switch (formula.kind) {
    case "fixed": {
      const base = utcDate(year, formula.month, formula.day);
      if (formula.before) base.setUTCDate(base.getUTCDate() - 1);
      return base;
    }
    case "end_of_next_month": {
      const next = addMonths(year, periodIndex, 1);
      return lastDayOfMonth(next.year, next.month);
    }
    case "end_of_first_month_of_next_quarter": {
      // T1 -> 30 avril, T2 -> 31 juillet, T3 -> 31 octobre, T4 -> 31 janvier N+1
      const firstMonthOfQuarter = (periodIndex - 1) * 3 + 1;
      const next = addMonths(year, firstMonthOfQuarter, 3);
      return lastDayOfMonth(next.year, next.month);
    }
    case "day_of_next_month": {
      const next = addMonths(year, periodIndex, 1);
      return utcDate(next.year, next.month, formula.day);
    }
    case "months_after_fy_end": {
      const end = utcDate(year, client.fiscalYearEndMonth, client.fiscalYearEndDay);
      const target = addMonths(
        end.getUTCFullYear(),
        end.getUTCMonth() + 1,
        formula.months,
      );
      return lastDayOfMonth(target.year, target.month);
    }
    case "end_of_nth_month_after_fy_start": {
      const start = fiscalYearStart(year, client.fiscalYearEndMonth);
      const target = addMonths(start.year, start.month, formula.months - 1);
      return lastDayOfMonth(target.year, target.month);
    }
    case "end_of_quarter_after_fy_start": {
      const start = fiscalYearStart(year, client.fiscalYearEndMonth);
      const target = addMonths(start.year, start.month, periodIndex * 3 - 1);
      return lastDayOfMonth(target.year, target.month);
    }
    default: {
      const exhaustive: never = formula;
      throw new Error(`Formule de date inconnue : ${JSON.stringify(exhaustive)}`);
    }
  }
}

/**
 * Génère les échéances d'un dossier pour une année civile.
 * Rien n'est produit avant la date de prise en charge du client : un cabinet qui importe
 * ses dossiers ne doit pas voir tout son historique en rouge le premier jour.
 */
export function generateDeadlines(input: {
  client: ClientInput;
  rules: RuleInput[];
  year: number;
  holidays?: Set<string>;
  saturdayIsHoliday?: boolean;
}): GeneratedDeadline[] {
  const { client, rules, year } = input;
  const results: GeneratedDeadline[] = [];
  const dormant = client.activityState && client.activityState !== "running";

  for (const rule of rules) {
    if (!ruleApplies(rule.appliesTo, client)) continue;
    // Un dossier radié ou en liquidation ne génère plus d'obligations récurrentes.
    if (dormant && rule.frequency !== "yearly") continue;

    for (const period of periodsForYear(rule.frequency, year)) {
      const raw = computeDueDate(rule.dateFormula, {
        year,
        periodIndex: period.index,
        frequency: rule.frequency,
        client,
      });
      const dueDate = shiftToBusinessDay(raw, {
        holidays: input.holidays,
        saturdayIsHoliday: input.saturdayIsHoliday,
      });
      if (dueDate.getTime() < client.takeoverDate.getTime()) continue;

      results.push({
        ruleCode: rule.code,
        ruleId: rule.id,
        label: rule.label,
        periodLabel: `${rule.code} ${period.label}`,
        dueDate,
        managedBy: rule.managedByDefault ?? "cabinet",
      });
    }
  }
  return results.sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime());
}

// ---------------------------------------------------------------------------
// Estimation du coût d'un retard
// ---------------------------------------------------------------------------

export type PenaltyFormula =
  /** CGI art. 184 : dépôt tardif. 5 % ≤ 30 jours, 15 % au-delà, minimum paramétrable. */
  | { kind: "cgi_184"; minimum?: number }
  /** CGI art. 208 : paiement tardif. 10 % (5 % si ≤ 30 j), 20 % pour TVA et retenues, + 5 % + 0,5 %/mois. */
  | { kind: "cgi_208"; vatOrWithholding?: boolean }
  /** CNSS : 3 % le premier mois puis 0,5 %/mois (AMO : 1 %/mois). */
  | { kind: "cnss"; amo?: boolean }
  /** Majoration à taux fixe avec minimum (taxes locales, loi 47-06 art. 134). */
  | { kind: "flat"; rate: number; minimum?: number };

/**
 * Estimation indicative, en centimes de dirham, du coût d'un retard.
 * Volontairement conservatrice : elle sert à rendre le rouge parlant pour un gérant,
 * jamais à remplacer le calcul de l'administration.
 */
export function estimatePenalty(
  formula: PenaltyFormula,
  input: { amount: number; daysLate: number },
): number {
  const { amount, daysLate } = input;
  if (daysLate <= 0 || amount <= 0) return 0;
  const monthsLate = Math.max(1, Math.ceil(daysLate / 30));

  switch (formula.kind) {
    case "cgi_184": {
      const rate = daysLate <= 30 ? 0.05 : 0.15;
      return Math.max(Math.round(amount * rate), formula.minimum ?? 50000);
    }
    case "cgi_208": {
      const base = formula.vatOrWithholding ? 0.2 : daysLate <= 30 ? 0.05 : 0.1;
      const surcharge = 0.05 + 0.005 * (monthsLate - 1);
      return Math.round(amount * (base + surcharge));
    }
    case "cnss": {
      const rate = formula.amo ? 0.01 * monthsLate : 0.03 + 0.005 * (monthsLate - 1);
      return Math.round(amount * rate);
    }
    case "flat":
      return Math.max(Math.round(amount * formula.rate), formula.minimum ?? 0);
    default: {
      const exhaustive: never = formula;
      throw new Error(`Formule de pénalité inconnue : ${JSON.stringify(exhaustive)}`);
    }
  }
}

/** Statut affiché d'une échéance, à partir de son état et de la date du jour. */
export function deadlineStatus(input: {
  status: string;
  dueDate: Date;
  now?: Date;
  amberDays?: number;
}): "done" | "overdue" | "soon" | "upcoming" | "not_applicable" {
  const now = input.now ?? new Date();
  if (input.status === "not_applicable") return "not_applicable";
  if (input.status === "paid") return "done";
  // « Déclaré mais non payé » reste en retard après l'échéance : déclarer ne suffit pas.
  if (input.status === "declared" && input.dueDate.getTime() >= now.getTime()) return "done";
  if (input.dueDate.getTime() < now.getTime()) return "overdue";
  const amberDays = input.amberDays ?? 15;
  const days = (input.dueDate.getTime() - now.getTime()) / 86400000;
  return days <= amberDays ? "soon" : "upcoming";
}
