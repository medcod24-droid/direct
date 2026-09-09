/**
 * Grille de calendrier et heures murales.
 *
 * **Tout est lu et écrit en UTC, sans conversion.** Un rendez-vous saisi à 9 h
 * doit s'afficher à 9 h, que le serveur tourne à Casablanca ou sur un hébergeur
 * réglé en UTC. Passer par l'heure locale du runtime aurait décalé tous les
 * horaires d'une heure en production, sans erreur visible ; et un cabinet
 * n'exerce que dans un seul fuseau, l'heure murale suffit donc.
 *
 * Module pur, sans base de données ni dépendance à l'horloge du serveur.
 */

const DAY_MS = 86_400_000;

export const WEEKDAY_LABELS = ["lun.", "mar.", "mer.", "jeu.", "ven.", "sam.", "dim."] as const;

export const MONTH_LABELS = [
  "janvier", "février", "mars", "avril", "mai", "juin",
  "juillet", "août", "septembre", "octobre", "novembre", "décembre",
] as const;

export type CalendarDay = {
  /** Minuit UTC du jour. */
  date: Date;
  /** Clé de regroupement : « 2026-09-15 ». */
  key: string;
  dayOfMonth: number;
  /** Faux pour les jours des mois voisins qui complètent la grille. */
  inMonth: boolean;
  isWeekend: boolean;
};

/** Clé de jour, en composantes UTC. */
export function dayKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Minuit UTC du jour de `date`. */
export function startOfDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

/**
 * Grille du mois, semaines commençant le lundi.
 *
 * Chaque semaine est complétée par les jours des mois voisins : un mois qui
 * commence un dimanche laisserait sinon six cases vides en tête, et les colonnes
 * ne correspondraient plus aux jours. Les semaines de fin entièrement hors du
 * mois, elles, sont retirées : elles n'afficheraient qu'une bande grise.
 */
export function monthGrid(year: number, month: number): CalendarDay[][] {
  const first = new Date(Date.UTC(year, month, 1));
  // getUTCDay : 0 = dimanche. On veut lundi = 0.
  const offset = (first.getUTCDay() + 6) % 7;
  const start = new Date(first.getTime() - offset * DAY_MS);

  const weeks: CalendarDay[][] = [];
  for (let week = 0; week < 6; week += 1) {
    const days: CalendarDay[] = [];
    for (let index = 0; index < 7; index += 1) {
      const date = new Date(start.getTime() + (week * 7 + index) * DAY_MS);
      days.push({
        date,
        key: dayKey(date),
        dayOfMonth: date.getUTCDate(),
        inMonth: date.getUTCMonth() === month && date.getUTCFullYear() === year,
        isWeekend: index >= 5,
      });
    }
    weeks.push(days);
  }

  // Les semaines de fin entièrement hors du mois n'apportent rien : février
  // commençant un lundi en occuperait deux, vides, sous quatre semaines pleines.
  while (weeks.length > 1) {
    const last = weeks[weeks.length - 1];
    if (last && last.every((day) => !day.inMonth)) weeks.pop();
    else break;
  }

  return weeks;
}

/** Bornes UTC du mois affiché, grille comprise, pour une seule requête. */
export function monthRange(year: number, month: number): { from: Date; to: Date } {
  const weeks = monthGrid(year, month);
  const first = weeks[0]?.[0]?.date ?? new Date(Date.UTC(year, month, 1));
  const lastWeek = weeks[weeks.length - 1];
  const last = lastWeek?.[6]?.date ?? new Date(Date.UTC(year, month + 1, 0));
  return { from: first, to: new Date(last.getTime() + DAY_MS) };
}

/** « 2026-09 » → { year, month }. Toute valeur inexploitable renvoie `null`. */
export function parseMonth(value: string | undefined): { year: number; month: number } | null {
  if (!value) return null;
  const match = /^(\d{4})-(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]) - 1;
  if (year < 1970 || year > 2200 || month < 0 || month > 11) return null;
  return { year, month };
}

/** { year, month } → « 2026-09 ». */
export function formatMonth(year: number, month: number): string {
  return `${year}-${String(month + 1).padStart(2, "0")}`;
}

/** Mois voisin, en gérant le passage d'année. */
export function shiftMonth(year: number, month: number, delta: number) {
  const date = new Date(Date.UTC(year, month + delta, 1));
  return { year: date.getUTCFullYear(), month: date.getUTCMonth() };
}

export function monthTitle(year: number, month: number): string {
  return `${MONTH_LABELS[month] ?? ""} ${year}`;
}

/* --------------------------------------------------------------------------
   Heures murales
   -------------------------------------------------------------------------- */

/** « 09:30 ». */
export function wallTime(date: Date): string {
  return `${String(date.getUTCHours()).padStart(2, "0")}:${String(date.getUTCMinutes()).padStart(2, "0")}`;
}

/** « 15/09/2026 ». */
export function wallDate(date: Date): string {
  return `${String(date.getUTCDate()).padStart(2, "0")}/${String(date.getUTCMonth() + 1).padStart(2, "0")}/${date.getUTCFullYear()}`;
}

/** « 15 septembre 2026 ». */
export function wallDateLong(date: Date): string {
  return `${date.getUTCDate()} ${MONTH_LABELS[date.getUTCMonth()] ?? ""} ${date.getUTCFullYear()}`;
}

/** Valeur d'un `<input type="datetime-local">` : « 2026-09-15T09:30 ». */
export function wallInputValue(date: Date): string {
  return `${dayKey(date)}T${wallTime(date)}`;
}

/**
 * Lit la valeur d'un `<input type="datetime-local">` comme une heure murale.
 *
 * Le suffixe `Z` est ajouté volontairement : sans lui, `new Date()` interprète
 * la chaîne dans le fuseau du runtime, et le même formulaire donnerait deux
 * horaires différents selon la machine.
 */
export function parseWallInput(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(value.trim());
  if (!match) return null;
  const date = new Date(`${match[1]}-${match[2]}-${match[3]}T${match[4]}:${match[5]}:00Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** Fin d'un rendez-vous, pour l'affichage « 09:00 – 09:30 ». */
export function endOf(startsAt: Date, durationMinutes: number): Date {
  return new Date(startsAt.getTime() + durationMinutes * 60_000);
}
