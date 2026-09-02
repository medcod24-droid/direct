import type { Locale } from "@/lib/i18n";

/**
 * Formatage d'affichage. Les montants sont stockés en CENTIMES de dirham
 * partout dans l'application : aucun flottant n'entre ici, tous les calculs
 * se font en entiers puis la partie décimale est construite à la main.
 *
 * Le formatage est volontairement fait sans `Intl` pour rester identique
 * entre le rendu serveur et le rendu client (aucune dépendance à l'ICU
 * embarqué dans le runtime Node).
 */

/** Espace insécable — séparateur de milliers et espace avant la devise. */
const NBSP = "\u00A0";

export type DateInput = Date | string | number;

/* ==========================================================================
   Montants
   ========================================================================== */

export type FormatMadOptions = {
  /** Masquer le suffixe « MAD ». */
  currency?: boolean;
  /** Toujours préfixer d'un signe (utile pour les variations). */
  signed?: boolean;
};

/**
 * `formatMad(120000)` → « 1 200,00 MAD » (espaces insécables).
 * L'entrée est un nombre entier de centimes ; une valeur non entière est
 * tronquée plutôt qu'arrondie à l'aveugle.
 */
export function formatMad(centimes: number, options: FormatMadOptions = {}): string {
  const { currency = true, signed = false } = options;

  if (!Number.isFinite(centimes)) return currency ? `—${NBSP}MAD` : "—";

  const total = Math.trunc(centimes);
  const negative = total < 0;
  const absolute = Math.abs(total);

  const units = Math.trunc(absolute / 100);
  const cents = absolute % 100;

  const sign = negative ? "-" : signed && total > 0 ? "+" : "";
  const body = `${sign}${groupThousands(units)},${String(cents).padStart(2, "0")}`;

  return currency ? `${body}${NBSP}MAD` : body;
}

/** Variante compacte pour les tuiles de KPI : « 1,2 M MAD ». */
export function formatMadCompact(centimes: number): string {
  if (!Number.isFinite(centimes)) return `—${NBSP}MAD`;

  const total = Math.trunc(centimes);
  const absoluteUnits = Math.trunc(Math.abs(total) / 100);
  if (absoluteUnits < 100_000) return formatMad(total);

  const sign = total < 0 ? "-" : "";
  const millions = absoluteUnits >= 1_000_000;
  const scaled = millions ? Math.round(absoluteUnits / 100_000) : Math.round(absoluteUnits / 100);
  const whole = Math.trunc(scaled / 10);
  const decimal = scaled % 10;
  const suffix = millions ? "M" : "k";

  return `${sign}${groupThousands(whole)},${decimal}${NBSP}${suffix}${NBSP}MAD`;
}

/** Sépare les milliers par une espace insécable : 1200 → « 1 200 ». */
function groupThousands(value: number): string {
  const digits = String(Math.abs(Math.trunc(value)));
  let out = "";
  for (let i = 0; i < digits.length; i += 1) {
    const fromEnd = digits.length - i;
    out += digits[i] ?? "";
    if (fromEnd > 1 && (fromEnd - 1) % 3 === 0) out += NBSP;
  }
  return out;
}

/* ==========================================================================
   Dates
   ========================================================================== */

const MONTHS_LONG: Record<Locale, readonly string[]> = {
  fr: [
    "janvier", "février", "mars", "avril", "mai", "juin",
    "juillet", "août", "septembre", "octobre", "novembre", "décembre",
  ],
  en: [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ],
  // Noms de mois usuels au Maroc.
  ar: [
    "يناير", "فبراير", "مارس", "أبريل", "ماي", "يونيو",
    "يوليوز", "غشت", "شتنبر", "أكتوبر", "نونبر", "دجنبر",
  ],
};

/** Convertit toute entrée en `Date`, ou `null` si la valeur est inexploitable. */
export function toDate(value: DateInput): Date | null {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** Format court, identique dans les trois langues : « 31/03/2027 ». */
export function formatDate(value: DateInput, _locale: Locale = "fr"): string {
  const date = toDate(value);
  if (!date) return "—";
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${day}/${month}/${date.getFullYear()}`;
}

/** Format long : « 31 mars 2027 ». */
export function formatDateLong(value: DateInput, locale: Locale = "fr"): string {
  const date = toDate(value);
  if (!date) return "—";
  const month = MONTHS_LONG[locale][date.getMonth()] ?? "";
  const day = date.getDate();
  const year = date.getFullYear();
  return locale === "en" ? `${month} ${day}, ${year}` : `${day} ${month} ${year}`;
}

/** Date + heure : « 31/03/2027 14:05 ». */
export function formatDateTime(value: DateInput, locale: Locale = "fr"): string {
  const date = toDate(value);
  if (!date) return "—";
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${formatDate(date, locale)} ${hours}:${minutes}`;
}

/** Nombre de jours calendaires entre aujourd'hui et `value` (négatif = passé). */
export function daysUntil(value: DateInput, from: Date = new Date()): number | null {
  const date = toDate(value);
  if (!date) return null;
  const MS_PER_DAY = 86_400_000;
  const target = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
  const origin = Date.UTC(from.getFullYear(), from.getMonth(), from.getDate());
  return Math.round((target - origin) / MS_PER_DAY);
}

const RELATIVE: Record<Locale, {
  today: string;
  tomorrow: string;
  yesterday: string;
  future: (n: number) => string;
  past: (n: number) => string;
}> = {
  fr: {
    today: "aujourd'hui",
    tomorrow: "demain",
    yesterday: "hier",
    future: (n) => `dans ${n} jours`,
    past: (n) => `il y a ${n} jours`,
  },
  en: {
    today: "today",
    tomorrow: "tomorrow",
    yesterday: "yesterday",
    future: (n) => `in ${n} days`,
    past: (n) => `${n} days ago`,
  },
  ar: {
    today: "اليوم",
    tomorrow: "غدًا",
    yesterday: "أمس",
    future: (n) => `بعد ${n} أيام`,
    past: (n) => `منذ ${n} أيام`,
  },
};

/** « dans 7 jours » / « il y a 3 jours » / « aujourd'hui ». */
export function relativeDays(value: DateInput, locale: Locale = "fr", from: Date = new Date()): string {
  const delta = daysUntil(value, from);
  if (delta === null) return "—";

  const words = RELATIVE[locale];
  if (delta === 0) return words.today;
  if (delta === 1) return words.tomorrow;
  if (delta === -1) return words.yesterday;
  return delta > 0 ? words.future(delta) : words.past(Math.abs(delta));
}

/* ==========================================================================
   Divers
   ========================================================================== */

/** « Ahmed Benali » → « AB ». Une seule lettre si un seul mot exploitable. */
export function initials(name: string): string {
  const words = name
    .trim()
    .split(/[\s'’_-]+/u)
    .filter((word) => word.length > 0 && /\p{L}|\p{N}/u.test(word));

  if (words.length === 0) return "?";

  const first = words[0] ?? "";
  const last = words.length > 1 ? words[words.length - 1] ?? "" : "";
  const letters = `${first.charAt(0)}${last.charAt(0)}`;

  return letters.toLocaleUpperCase("fr-FR");
}

/** Taille de fichier lisible : « 2,4 Mo ». */
export function formatBytes(bytes: number, locale: Locale = "fr"): string {
  if (!Number.isFinite(bytes) || bytes < 0) return "—";
  const units = locale === "fr" ? ["o", "Ko", "Mo", "Go"] : ["B", "KB", "MB", "GB"];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  const rounded = Math.round(value * 10);
  const body = unit === 0
    ? String(Math.round(value))
    : `${Math.trunc(rounded / 10)},${rounded % 10}`;
  return `${body}${NBSP}${units[unit] ?? ""}`;
}

/** Nombre entier avec séparateurs de milliers : 12345 → « 12 345 ». */
export function formatNumber(value: number): string {
  if (!Number.isFinite(value)) return "—";
  const sign = value < 0 ? "-" : "";
  return `${sign}${groupThousands(Math.abs(Math.trunc(value)))}`;
}

/** Pourcentage entier : 0.732 → « 73 % ». */
export function formatPercent(ratio: number, fractionDigits: 0 | 1 = 0): string {
  if (!Number.isFinite(ratio)) return "—";
  const scaled = Math.round(ratio * 100 * 10 ** fractionDigits);
  const body = fractionDigits === 0
    ? String(scaled)
    : `${Math.trunc(scaled / 10)},${Math.abs(scaled % 10)}`;
  return `${body}${NBSP}%`;
}
