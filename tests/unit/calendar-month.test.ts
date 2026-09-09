import { describe, expect, it } from "vitest";
import {
  dayKey,
  endOf,
  formatMonth,
  monthGrid,
  monthRange,
  parseMonth,
  parseWallInput,
  shiftMonth,
  wallInputValue,
  wallTime,
} from "@/lib/calendar/month";

/**
 * Grille de calendrier et heures murales.
 *
 * L'essentiel tient en une phrase : rien ne doit dépendre du fuseau du runtime.
 * Ces essais tournent aussi bien à Casablanca que sur un hébergeur en UTC.
 */
describe("grille du mois", () => {
  it("commence chaque semaine un lundi", () => {
    const weeks = monthGrid(2026, 8); // septembre 2026
    for (const week of weeks) {
      expect(week).toHaveLength(7);
      expect(week[0]?.date.getUTCDay()).toBe(1);
    }
  });

  it("complète le début et la fin avec les mois voisins", () => {
    // 1er septembre 2026 est un mardi : la grille commence le lundi 31 août.
    const weeks = monthGrid(2026, 8);
    expect(weeks[0]?.[0]?.key).toBe("2026-08-31");
    expect(weeks[0]?.[0]?.inMonth).toBe(false);
    expect(weeks[0]?.[1]?.key).toBe("2026-09-01");
    expect(weeks[0]?.[1]?.inMonth).toBe(true);
  });

  it("ne garde pas une sixième semaine entièrement hors du mois", () => {
    // Février 2027 commence un lundi et compte 28 jours : quatre semaines pleines.
    const weeks = monthGrid(2027, 1);
    expect(weeks).toHaveLength(4);
    expect(weeks.every((week) => week.some((day) => day.inMonth))).toBe(true);
  });

  it("garde une sixième semaine quand le mois déborde dessus", () => {
    // Mai 2027 commence un samedi et compte 31 jours.
    const weeks = monthGrid(2027, 4);
    expect(weeks.length).toBeGreaterThan(4);
    expect(weeks[weeks.length - 1]?.some((day) => day.inMonth)).toBe(true);
  });

  it("marque le week-end sur les deux dernières colonnes", () => {
    const week = monthGrid(2026, 8)[0];
    expect(week?.map((day) => day.isWeekend)).toEqual([
      false, false, false, false, false, true, true,
    ]);
  });

  it("borne la plage sur la grille affichée", () => {
    const { from, to } = monthRange(2026, 8);
    const weeks = monthGrid(2026, 8);
    expect(dayKey(from)).toBe(weeks[0]?.[0]?.key);
    // La borne haute est exclusive : le lendemain du dernier jour affiché.
    const last = weeks[weeks.length - 1]?.[6];
    expect(to.getTime() - (last?.date.getTime() ?? 0)).toBe(86_400_000);
  });
});

describe("mois en paramètre d'URL", () => {
  it("relit une valeur bien formée", () => {
    expect(parseMonth("2026-09")).toEqual({ year: 2026, month: 8 });
  });

  it("refuse ce qui n'est pas un mois", () => {
    for (const value of ["", "2026-13", "septembre", "2026/09", undefined]) {
      expect(parseMonth(value)).toBeNull();
    }
  });

  it("fait l'aller-retour", () => {
    expect(formatMonth(2026, 8)).toBe("2026-09");
    expect(parseMonth(formatMonth(2026, 0))).toEqual({ year: 2026, month: 0 });
  });

  it("passe l'année en changeant de mois", () => {
    expect(shiftMonth(2026, 11, 1)).toEqual({ year: 2027, month: 0 });
    expect(shiftMonth(2026, 0, -1)).toEqual({ year: 2025, month: 11 });
  });
});

describe("heures murales", () => {
  it("relit une saisie sans la décaler", () => {
    const parsed = parseWallInput("2026-09-15T09:30");
    expect(parsed).not.toBeNull();
    expect(wallTime(parsed as Date)).toBe("09:30");
    expect(dayKey(parsed as Date)).toBe("2026-09-15");
  });

  it("fait l'aller-retour avec le formulaire", () => {
    const value = "2026-12-31T23:45";
    expect(wallInputValue(parseWallInput(value) as Date)).toBe(value);
  });

  it("refuse une saisie inexploitable", () => {
    for (const value of ["", "demain", "2026-09-15", "2026-09-15 09:30"]) {
      expect(parseWallInput(value)).toBeNull();
    }
  });

  it("calcule la fin d'un rendez-vous", () => {
    const start = parseWallInput("2026-09-15T09:00") as Date;
    expect(wallTime(endOf(start, 45))).toBe("09:45");
    expect(wallTime(endOf(start, 90))).toBe("10:30");
  });
});
