import { describe, expect, it } from "vitest";
import {
  computeDueDate,
  deadlineStatus,
  estimatePenalty,
  generateDeadlines,
  lastDayOfMonth,
  periodsForYear,
  ruleApplies,
  shiftToBusinessDay,
  utcDate,
  type ClientInput,
  type DateFormula,
  type RuleInput,
} from "@/lib/deadlines/engine";

/**
 * Tests du moteur d'échéances.
 *
 * Calcul pur : aucune base de données. On vérifie surtout les deux pièges métier
 * documentés dans le module — « avant le 1er X » et l'exercice décalé (CGI art. 170) —
 * ainsi que le décalage jour ouvrable (CGI art. 163).
 */

const iso = (date: Date) => date.toISOString().slice(0, 10);

function makeClientInput(overrides: Partial<ClientInput> = {}): ClientInput {
  return {
    id: "cli-1",
    subtype: "sarl",
    taxRegime: "is",
    vatRegime: "monthly",
    isEmployer: true,
    referenceRevenue: 5_000_000,
    fiscalYearEndMonth: 12,
    fiscalYearEndDay: 31,
    takeoverDate: utcDate(2020, 1, 1),
    activityState: "running",
    ...overrides,
  };
}

function due(
  formula: DateFormula,
  options: { year?: number; periodIndex?: number; client?: ClientInput } = {},
): string {
  return iso(
    computeDueDate(formula, {
      year: options.year ?? 2026,
      periodIndex: options.periodIndex ?? 1,
      frequency: "monthly",
      client: options.client ?? makeClientInput(),
    }),
  );
}

describe("utilitaires de dates", () => {
  it("utcDate construit une date à minuit UTC", () => {
    const date = utcDate(2026, 2, 28);
    expect(iso(date)).toBe("2026-02-28");
    expect(date.getUTCHours()).toBe(0);
    expect(date.getUTCMinutes()).toBe(0);
    expect(date.getUTCMilliseconds()).toBe(0);
  });

  it("lastDayOfMonth gère les mois courts et les années bissextiles", () => {
    expect(iso(lastDayOfMonth(2026, 2))).toBe("2026-02-28");
    expect(iso(lastDayOfMonth(2028, 2))).toBe("2028-02-29");
    expect(iso(lastDayOfMonth(2026, 4))).toBe("2026-04-30");
    expect(iso(lastDayOfMonth(2026, 12))).toBe("2026-12-31");
  });

  it("periodsForYear renvoie le bon nombre de périodes par fréquence", () => {
    expect(periodsForYear("monthly", 2026)).toHaveLength(12);
    expect(periodsForYear("monthly", 2026)[0]).toEqual({ index: 1, label: "janvier 2026" });
    expect(periodsForYear("quarterly", 2026)).toHaveLength(4);
    expect(periodsForYear("quarterly", 2026)[3]).toEqual({ index: 4, label: "T4 2026" });
    expect(periodsForYear("yearly", 2026)).toEqual([{ index: 1, label: "2026" }]);
    expect(periodsForYear("event", 2026)).toEqual([]);
  });
});

describe("computeDueDate — formule « fixed »", () => {
  it("« avant le 1er mars » donne le 28 février 2026 (année non bissextile)", () => {
    expect(due({ kind: "fixed", month: 3, day: 1, before: true })).toBe("2026-02-28");
  });

  it("« avant le 1er mai » donne le 30 avril", () => {
    expect(due({ kind: "fixed", month: 5, day: 1, before: true })).toBe("2026-04-30");
  });

  it("« avant le 1er avril » donne le 31 mars", () => {
    expect(due({ kind: "fixed", month: 4, day: 1, before: true })).toBe("2026-03-31");
  });

  it("« avant le 1er janvier » recule sur l'année précédente", () => {
    expect(due({ kind: "fixed", month: 1, day: 1, before: true })).toBe("2025-12-31");
  });

  it("« avant le 1er mars » d'une année bissextile donne le 29 février", () => {
    expect(due({ kind: "fixed", month: 3, day: 1, before: true }, { year: 2028 })).toBe("2028-02-29");
  });

  it("une date fixe sans « before » n'est pas décalée", () => {
    expect(due({ kind: "fixed", month: 1, day: 31 })).toBe("2026-01-31");
    expect(due({ kind: "fixed", month: 3, day: 31 })).toBe("2026-03-31");
  });

  it("« before: false » est équivalent à l'absence de « before »", () => {
    expect(due({ kind: "fixed", month: 3, day: 1, before: false })).toBe("2026-03-01");
  });
});

describe("computeDueDate — formules périodiques", () => {
  it("end_of_next_month : janvier échoit fin février", () => {
    expect(due({ kind: "end_of_next_month" }, { periodIndex: 1 })).toBe("2026-02-28");
    expect(due({ kind: "end_of_next_month" }, { periodIndex: 1, year: 2028 })).toBe("2028-02-29");
  });

  it("end_of_next_month : décembre échoit le 31 janvier de l'année suivante", () => {
    expect(due({ kind: "end_of_next_month" }, { periodIndex: 12 })).toBe("2027-01-31");
  });

  it("end_of_next_month : chaque mois tombe bien le dernier jour du mois suivant", () => {
    expect(due({ kind: "end_of_next_month" }, { periodIndex: 3 })).toBe("2026-04-30");
    expect(due({ kind: "end_of_next_month" }, { periodIndex: 11 })).toBe("2026-12-31");
  });

  it("end_of_first_month_of_next_quarter : T1 échoit le 30 avril", () => {
    expect(due({ kind: "end_of_first_month_of_next_quarter" }, { periodIndex: 1 })).toBe("2026-04-30");
  });

  it("end_of_first_month_of_next_quarter : T4 échoit le 31 janvier de l'année suivante", () => {
    expect(due({ kind: "end_of_first_month_of_next_quarter" }, { periodIndex: 4 })).toBe("2027-01-31");
  });

  it("end_of_first_month_of_next_quarter : T2 et T3 échoient fin juillet et fin octobre", () => {
    expect(due({ kind: "end_of_first_month_of_next_quarter" }, { periodIndex: 2 })).toBe("2026-07-31");
    expect(due({ kind: "end_of_first_month_of_next_quarter" }, { periodIndex: 3 })).toBe("2026-10-31");
  });

  it("day_of_next_month : la CNSS de janvier échoit le 10 février", () => {
    expect(due({ kind: "day_of_next_month", day: 10 }, { periodIndex: 1 })).toBe("2026-02-10");
  });

  it("day_of_next_month : décembre échoit le 10 janvier de l'année suivante", () => {
    expect(due({ kind: "day_of_next_month", day: 10 }, { periodIndex: 12 })).toBe("2027-01-10");
  });
});

describe("computeDueDate — formules adossées à l'exercice", () => {
  it("months_after_fy_end : clôture au 31/12, la liasse échoit 3 mois après", () => {
    const client = makeClientInput({ fiscalYearEndMonth: 12, fiscalYearEndDay: 31 });
    expect(due({ kind: "months_after_fy_end", months: 3 }, { client })).toBe("2027-03-31");
  });

  it("months_after_fy_end : un exercice décalé (clôture 30/06) décale la liasse au 30 septembre", () => {
    const client = makeClientInput({ fiscalYearEndMonth: 6, fiscalYearEndDay: 30 });
    expect(due({ kind: "months_after_fy_end", months: 3 }, { client })).toBe("2026-09-30");
  });

  it("months_after_fy_end : clôture 31/03, 3 mois donnent le 30 juin", () => {
    const client = makeClientInput({ fiscalYearEndMonth: 3, fiscalYearEndDay: 31 });
    expect(due({ kind: "months_after_fy_end", months: 3 }, { client })).toBe("2026-06-30");
  });

  it("end_of_nth_month_after_fy_start : 3e mois suivant l'ouverture de l'exercice", () => {
    const calendaire = makeClientInput({ fiscalYearEndMonth: 12, fiscalYearEndDay: 31 });
    // Exercice 2026 ouvert le 01/01/2026 : fin du 3e mois = 31/03/2026.
    expect(due({ kind: "end_of_nth_month_after_fy_start", months: 3 }, { client: calendaire })).toBe(
      "2026-03-31",
    );

    const decale = makeClientInput({ fiscalYearEndMonth: 6, fiscalYearEndDay: 30 });
    // Exercice ouvert le 01/07/2026 : fin du 3e mois = 30/09/2026.
    expect(due({ kind: "end_of_nth_month_after_fy_start", months: 3 }, { client: decale })).toBe(
      "2026-09-30",
    );
  });

  it("end_of_quarter_after_fy_start : exercice calendaire, les acomptes tombent fin mars, juin, septembre et décembre", () => {
    const client = makeClientInput({ fiscalYearEndMonth: 12, fiscalYearEndDay: 31 });
    const dates = [1, 2, 3, 4].map((periodIndex) =>
      computeDueDate(
        { kind: "end_of_quarter_after_fy_start" },
        { year: 2026, periodIndex, frequency: "quarterly", client },
      ),
    );
    expect(dates.map((d) => `${d.getUTCMonth() + 1}/${d.getUTCDate()}`)).toEqual([
      "3/31",
      "6/30",
      "9/30",
      "12/31",
    ]);
    // Pour une clôture au 31 décembre, les quatre acomptes de l'exercice 2026 tombent
    // bien dans l'année 2026 (CGI art. 170).
    expect(dates.map(iso)).toEqual(["2026-03-31", "2026-06-30", "2026-09-30", "2026-12-31"]);
  });

  it("end_of_quarter_after_fy_start : un exercice clos le 30/06 décale les quatre acomptes (CGI art. 170)", () => {
    const client = makeClientInput({ fiscalYearEndMonth: 6, fiscalYearEndDay: 30 });
    const dates = [1, 2, 3, 4].map((periodIndex) =>
      iso(
        computeDueDate(
          { kind: "end_of_quarter_after_fy_start" },
          { year: 2026, periodIndex, frequency: "quarterly", client },
        ),
      ),
    );
    // Exercice ouvert le 01/07/2026 : fin des 3e, 6e, 9e et 12e mois.
    expect(dates).toEqual(["2026-09-30", "2026-12-31", "2027-03-31", "2027-06-30"]);
  });

  it("end_of_quarter_after_fy_start : les acomptes d'un exercice décalé diffèrent de ceux de l'année civile", () => {
    const calendaire = makeClientInput({ fiscalYearEndMonth: 12 });
    const decale = makeClientInput({ fiscalYearEndMonth: 6 });
    const first = (client: ClientInput) =>
      iso(
        computeDueDate(
          { kind: "end_of_quarter_after_fy_start" },
          { year: 2026, periodIndex: 1, frequency: "quarterly", client },
        ),
      );
    expect(first(calendaire)).not.toBe(first(decale));
  });

  it("une formule inconnue lève une erreur explicite", () => {
    expect(() =>
      computeDueDate({ kind: "inconnue" } as unknown as DateFormula, {
        year: 2026,
        periodIndex: 1,
        frequency: "yearly",
        client: makeClientInput(),
      }),
    ).toThrow(/Formule de date inconnue/);
  });
});

describe("shiftToBusinessDay", () => {
  it("un dimanche est reporté au lundi", () => {
    // 1er mars 2026 = dimanche.
    expect(iso(shiftToBusinessDay(utcDate(2026, 3, 1)))).toBe("2026-03-02");
  });

  it("un jour ouvrable normal n'est pas déplacé", () => {
    expect(iso(shiftToBusinessDay(utcDate(2026, 3, 31)))).toBe("2026-03-31");
  });

  it("un jour férié est reporté au jour suivant", () => {
    const holidays = new Set(["2026-05-01"]); // vendredi, fête du travail
    expect(iso(shiftToBusinessDay(utcDate(2026, 5, 1), { holidays }))).toBe("2026-05-02");
  });

  it("le samedi n'est pas chômé par défaut", () => {
    // 28 février 2026 = samedi.
    expect(iso(shiftToBusinessDay(utcDate(2026, 2, 28)))).toBe("2026-02-28");
  });

  it("le samedi est chômé quand saturdayIsHoliday vaut true", () => {
    expect(iso(shiftToBusinessDay(utcDate(2026, 2, 28), { saturdayIsHoliday: true }))).toBe(
      "2026-03-02",
    );
  });

  it("un férié suivi d'un dimanche enchaîne le report jusqu'au lundi", () => {
    const holidays = new Set(["2026-05-30"]); // samedi férié, suivi du dimanche 31 mai
    expect(iso(shiftToBusinessDay(utcDate(2026, 5, 30), { holidays }))).toBe("2026-06-01");
  });

  it("plusieurs fériés consécutifs sont enchaînés", () => {
    const holidays = new Set(["2026-03-02", "2026-03-03", "2026-03-04"]);
    expect(iso(shiftToBusinessDay(utcDate(2026, 3, 1), { holidays }))).toBe("2026-03-05");
  });

  it("la date d'origine n'est pas mutée", () => {
    const origin = utcDate(2026, 3, 1);
    shiftToBusinessDay(origin);
    expect(iso(origin)).toBe("2026-03-01");
  });
});

describe("ruleApplies", () => {
  const client = makeClientInput({
    taxRegime: "is",
    vatRegime: "monthly",
    subtype: "sarl",
    isEmployer: true,
    referenceRevenue: 5_000_000,
  });

  it("une condition absente s'applique à tout le monde", () => {
    expect(ruleApplies({}, client)).toBe(true);
    expect(ruleApplies({}, makeClientInput({ taxRegime: "cpu", isEmployer: false }))).toBe(true);
  });

  it("un tableau vide n'est pas une condition restrictive", () => {
    expect(ruleApplies({ taxRegime: [], vatRegime: [], subtype: [] }, client)).toBe(true);
  });

  it("filtre sur le régime fiscal", () => {
    expect(ruleApplies({ taxRegime: ["is"] }, client)).toBe(true);
    expect(ruleApplies({ taxRegime: ["rnr", "rns"] }, client)).toBe(false);
  });

  it("filtre sur le régime de TVA", () => {
    expect(ruleApplies({ vatRegime: ["monthly"] }, client)).toBe(true);
    expect(ruleApplies({ vatRegime: ["quarterly"] }, client)).toBe(false);
    expect(ruleApplies({ vatRegime: ["exempt"] }, makeClientInput({ vatRegime: "exempt" }))).toBe(true);
  });

  it("filtre sur la forme juridique", () => {
    expect(ruleApplies({ subtype: ["sarl", "sa"] }, client)).toBe(true);
    expect(ruleApplies({ subtype: ["auto_entrepreneur"] }, client)).toBe(false);
  });

  it("isEmployer: true ne retient que les employeurs", () => {
    expect(ruleApplies({ isEmployer: true }, client)).toBe(true);
    expect(ruleApplies({ isEmployer: true }, makeClientInput({ isEmployer: false }))).toBe(false);
  });

  it("isEmployer: false est une vraie condition, pas une absence de condition", () => {
    expect(ruleApplies({ isEmployer: false }, client)).toBe(false);
    expect(ruleApplies({ isEmployer: false }, makeClientInput({ isEmployer: false }))).toBe(true);
  });

  it("filtre sur le chiffre d'affaires minimum", () => {
    expect(ruleApplies({ minRevenue: 1_000_000 }, client)).toBe(true);
    expect(ruleApplies({ minRevenue: 10_000_000 }, client)).toBe(false);
    // Borne incluse.
    expect(ruleApplies({ minRevenue: 5_000_000 }, client)).toBe(true);
  });

  it("filtre sur le chiffre d'affaires maximum", () => {
    expect(ruleApplies({ maxRevenue: 10_000_000 }, client)).toBe(true);
    expect(ruleApplies({ maxRevenue: 1_000_000 }, client)).toBe(false);
    expect(ruleApplies({ maxRevenue: 5_000_000 }, client)).toBe(true);
  });

  it("un chiffre d'affaires absent est traité comme zéro", () => {
    const sansCa = makeClientInput({ referenceRevenue: null });
    expect(ruleApplies({ minRevenue: 1 }, sansCa)).toBe(false);
    expect(ruleApplies({ maxRevenue: 1 }, sansCa)).toBe(true);
  });

  it("toutes les conditions doivent passer simultanément", () => {
    const applies = {
      taxRegime: ["is"],
      vatRegime: ["monthly"],
      subtype: ["sarl"],
      isEmployer: true,
      minRevenue: 1_000_000,
      maxRevenue: 10_000_000,
    };
    expect(ruleApplies(applies, client)).toBe(true);
    expect(ruleApplies(applies, makeClientInput({ subtype: "sa" }))).toBe(false);
    expect(ruleApplies(applies, makeClientInput({ isEmployer: false }))).toBe(false);
  });
});

describe("generateDeadlines", () => {
  const rule = (overrides: Partial<RuleInput> = {}): RuleInput => ({
    code: "TVA",
    label: "Déclaration de TVA",
    frequency: "monthly",
    dateFormula: { kind: "end_of_next_month" },
    appliesTo: {},
    ...overrides,
  });

  it("génère le bon nombre d'échéances par fréquence", () => {
    const client = makeClientInput();
    const rules = [
      rule({ code: "TVA", frequency: "monthly" }),
      rule({ code: "ACOMPTE", frequency: "quarterly", dateFormula: { kind: "end_of_quarter_after_fy_start" } }),
      rule({ code: "LIASSE", frequency: "yearly", dateFormula: { kind: "months_after_fy_end", months: 3 } }),
      rule({ code: "CESSION", frequency: "event", dateFormula: { kind: "fixed", month: 6, day: 30 } }),
    ];
    const generated = generateDeadlines({ client, rules, year: 2026 });
    const count = (code: string) => generated.filter((d) => d.ruleCode === code).length;
    expect(count("TVA")).toBe(12);
    expect(count("ACOMPTE")).toBe(4);
    expect(count("LIASSE")).toBe(1);
    expect(count("CESSION")).toBe(0);
    expect(generated).toHaveLength(17);
  });

  it("ignore les règles qui ne s'appliquent pas au dossier", () => {
    const client = makeClientInput({ isEmployer: false });
    const generated = generateDeadlines({
      client,
      rules: [rule({ code: "CNSS", appliesTo: { isEmployer: true }, dateFormula: { kind: "day_of_next_month", day: 10 } })],
      year: 2026,
    });
    expect(generated).toEqual([]);
  });

  it("ne génère rien avant la date de prise en charge du dossier", () => {
    const client = makeClientInput({ takeoverDate: utcDate(2026, 7, 1) });
    const generated = generateDeadlines({ client, rules: [rule()], year: 2026 });
    // Les périodes janvier à mai échoient avant le 1er juillet 2026.
    expect(generated).toHaveLength(7);
    expect(generated.every((d) => d.dueDate.getTime() >= client.takeoverDate.getTime())).toBe(true);
    expect(iso(generated[0]!.dueDate)).toBe("2026-07-31");
  });

  it("un dossier en sommeil ou en liquidation ne conserve que les obligations annuelles", () => {
    const rules = [
      rule({ code: "TVA", frequency: "monthly" }),
      rule({ code: "CNSS", frequency: "quarterly" }),
      rule({ code: "LIASSE", frequency: "yearly", dateFormula: { kind: "months_after_fy_end", months: 3 } }),
    ];
    for (const state of ["dormant", "liquidation", "struck_off"]) {
      const generated = generateDeadlines({
        client: makeClientInput({ activityState: state }),
        rules,
        year: 2026,
      });
      expect(generated.map((d) => d.ruleCode)).toEqual(["LIASSE"]);
    }
  });

  it("un dossier en activité conserve toutes ses obligations", () => {
    const generated = generateDeadlines({
      client: makeClientInput({ activityState: "running" }),
      rules: [rule({ code: "TVA", frequency: "monthly" })],
      year: 2026,
    });
    expect(generated).toHaveLength(12);
  });

  it("les échéances sont triées par date", () => {
    const generated = generateDeadlines({
      client: makeClientInput(),
      rules: [
        rule({ code: "LIASSE", frequency: "yearly", dateFormula: { kind: "months_after_fy_end", months: 3 } }),
        rule({ code: "TVA", frequency: "monthly" }),
        rule({ code: "CNSS", frequency: "monthly", dateFormula: { kind: "day_of_next_month", day: 10 } }),
      ],
      year: 2026,
    });
    const times = generated.map((d) => d.dueDate.getTime());
    expect([...times].sort((a, b) => a - b)).toEqual(times);
  });

  it("le libellé de période est unique par règle et par période", () => {
    const generated = generateDeadlines({
      client: makeClientInput(),
      rules: [
        rule({ code: "TVA", frequency: "monthly" }),
        rule({ code: "CNSS", frequency: "monthly", dateFormula: { kind: "day_of_next_month", day: 10 } }),
      ],
      year: 2026,
    });
    const labels = generated.map((d) => d.periodLabel);
    expect(labels).toHaveLength(24);
    expect(new Set(labels).size).toBe(24);
    expect(labels).toContain("TVA janvier 2026");
    expect(labels).toContain("CNSS janvier 2026");
  });

  it("applique le décalage jour ouvrable et les fériés fournis", () => {
    const client = makeClientInput();
    const generated = generateDeadlines({
      client,
      rules: [rule({ code: "TVA", frequency: "monthly" })],
      year: 2026,
      holidays: new Set(["2026-04-30"]),
    });
    const byLabel = new Map(generated.map((d) => [d.periodLabel, iso(d.dueDate)]));
    // 31 mai 2026 est un dimanche : report au lundi 1er juin.
    expect(byLabel.get("TVA avril 2026")).toBe("2026-06-01");
    // 30 avril 2026 déclaré férié : report au 1er mai.
    expect(byLabel.get("TVA mars 2026")).toBe("2026-05-01");
  });

  it("reprend l'identifiant, le libellé et le responsable par défaut de la règle", () => {
    const [deadline] = generateDeadlines({
      client: makeClientInput(),
      rules: [
        rule({
          id: "rule-1",
          code: "LIASSE",
          label: "Liasse fiscale",
          frequency: "yearly",
          dateFormula: { kind: "months_after_fy_end", months: 3 },
          managedByDefault: "client",
        }),
      ],
      year: 2026,
    });
    expect(deadline).toMatchObject({
      ruleId: "rule-1",
      ruleCode: "LIASSE",
      label: "Liasse fiscale",
      periodLabel: "LIASSE 2026",
      managedBy: "client",
    });
  });

  it("le responsable par défaut est le cabinet", () => {
    const [deadline] = generateDeadlines({
      client: makeClientInput(),
      rules: [rule({ frequency: "yearly", dateFormula: { kind: "fixed", month: 3, day: 31 } })],
      year: 2026,
    });
    expect(deadline!.managedBy).toBe("cabinet");
  });
});

describe("estimatePenalty", () => {
  it("ne facture rien sans retard ni sans montant", () => {
    expect(estimatePenalty({ kind: "cgi_184" }, { amount: 1_000_000, daysLate: 0 })).toBe(0);
    expect(estimatePenalty({ kind: "cgi_184" }, { amount: 1_000_000, daysLate: -5 })).toBe(0);
    expect(estimatePenalty({ kind: "cgi_184" }, { amount: 0, daysLate: 45 })).toBe(0);
    expect(estimatePenalty({ kind: "cnss", amo: true }, { amount: 0, daysLate: 90 })).toBe(0);
  });

  it("CGI art. 184 : 5 % jusqu'à 30 jours de retard", () => {
    expect(estimatePenalty({ kind: "cgi_184" }, { amount: 2_000_000, daysLate: 10 })).toBe(100_000);
    expect(estimatePenalty({ kind: "cgi_184" }, { amount: 2_000_000, daysLate: 30 })).toBe(100_000);
  });

  it("CGI art. 184 : 15 % au-delà de 30 jours", () => {
    expect(estimatePenalty({ kind: "cgi_184" }, { amount: 2_000_000, daysLate: 31 })).toBe(300_000);
  });

  it("CGI art. 184 : un minimum de 500 dirhams s'applique aux petits montants", () => {
    expect(estimatePenalty({ kind: "cgi_184" }, { amount: 10_000, daysLate: 5 })).toBe(50_000);
    expect(estimatePenalty({ kind: "cgi_184", minimum: 100_000 }, { amount: 10_000, daysLate: 5 })).toBe(
      100_000,
    );
    // Le minimum ne s'applique plus dès que le pourcentage le dépasse.
    expect(estimatePenalty({ kind: "cgi_184", minimum: 100_000 }, { amount: 4_000_000, daysLate: 5 })).toBe(
      200_000,
    );
  });

  it("CGI art. 208 : TVA et retenues à la source majorées de 20 %", () => {
    // 20 % + 5 % de majoration, un mois de retard.
    expect(
      estimatePenalty({ kind: "cgi_208", vatOrWithholding: true }, { amount: 1_000_000, daysLate: 10 }),
    ).toBe(250_000);
  });

  it("CGI art. 208 : hors TVA, 5 % jusqu'à 30 jours puis 10 %", () => {
    expect(estimatePenalty({ kind: "cgi_208" }, { amount: 1_000_000, daysLate: 10 })).toBe(100_000);
    expect(estimatePenalty({ kind: "cgi_208" }, { amount: 1_000_000, daysLate: 31 })).toBe(155_000);
  });

  it("CGI art. 208 : la majoration croît de 0,5 % par mois supplémentaire", () => {
    const unMois = estimatePenalty(
      { kind: "cgi_208", vatOrWithholding: true },
      { amount: 1_000_000, daysLate: 30 },
    );
    const troisMois = estimatePenalty(
      { kind: "cgi_208", vatOrWithholding: true },
      { amount: 1_000_000, daysLate: 90 },
    );
    expect(unMois).toBe(250_000);
    expect(troisMois).toBe(260_000);
    expect(troisMois).toBeGreaterThan(unMois);
  });

  it("CNSS : 3 % le premier mois puis 0,5 % par mois", () => {
    expect(estimatePenalty({ kind: "cnss" }, { amount: 1_000_000, daysLate: 15 })).toBe(30_000);
    expect(estimatePenalty({ kind: "cnss" }, { amount: 1_000_000, daysLate: 60 })).toBe(35_000);
    expect(estimatePenalty({ kind: "cnss" }, { amount: 1_000_000, daysLate: 90 })).toBe(40_000);
  });

  it("CNSS : la variante AMO applique 1 % par mois", () => {
    expect(estimatePenalty({ kind: "cnss", amo: true }, { amount: 1_000_000, daysLate: 15 })).toBe(10_000);
    expect(estimatePenalty({ kind: "cnss", amo: true }, { amount: 1_000_000, daysLate: 90 })).toBe(30_000);
  });

  it("flat : taux fixe avec minimum", () => {
    expect(estimatePenalty({ kind: "flat", rate: 0.15 }, { amount: 1_000_000, daysLate: 10 })).toBe(150_000);
    expect(
      estimatePenalty({ kind: "flat", rate: 0.15, minimum: 50_000 }, { amount: 10_000, daysLate: 10 }),
    ).toBe(50_000);
    // Sans minimum explicite, le plancher est nul.
    expect(estimatePenalty({ kind: "flat", rate: 0.15 }, { amount: 100, daysLate: 10 })).toBe(15);
  });

  it("une formule de pénalité inconnue lève une erreur explicite", () => {
    expect(() =>
      estimatePenalty({ kind: "inconnue" } as unknown as { kind: "cgi_184" }, {
        amount: 1_000,
        daysLate: 10,
      }),
    ).toThrow(/Formule de pénalité inconnue/);
  });
});

describe("deadlineStatus", () => {
  const now = utcDate(2026, 6, 15);

  it("une échéance payée est terminée, même en retard", () => {
    expect(deadlineStatus({ status: "paid", dueDate: utcDate(2026, 1, 31), now })).toBe("done");
    expect(deadlineStatus({ status: "paid", dueDate: utcDate(2026, 12, 31), now })).toBe("done");
  });

  it("une échéance sans objet reste sans objet", () => {
    expect(deadlineStatus({ status: "not_applicable", dueDate: utcDate(2026, 1, 31), now })).toBe(
      "not_applicable",
    );
  });

  it("« déclaré » avant l'échéance est considéré comme fait", () => {
    expect(deadlineStatus({ status: "declared", dueDate: utcDate(2026, 6, 30), now })).toBe("done");
  });

  it("« déclaré » après l'échéance reste en retard : déclarer n'est pas payer", () => {
    expect(deadlineStatus({ status: "declared", dueDate: utcDate(2026, 5, 31), now })).toBe("overdue");
  });

  it("une échéance dépassée non traitée est en retard", () => {
    expect(deadlineStatus({ status: "upcoming", dueDate: utcDate(2026, 6, 14), now })).toBe("overdue");
    expect(deadlineStatus({ status: "in_progress", dueDate: utcDate(2026, 1, 31), now })).toBe("overdue");
  });

  it("une échéance proche passe en orange dans la fenêtre d'alerte", () => {
    expect(deadlineStatus({ status: "upcoming", dueDate: utcDate(2026, 6, 20), now })).toBe("soon");
    expect(deadlineStatus({ status: "upcoming", dueDate: utcDate(2026, 6, 30), now })).toBe("soon");
  });

  it("une échéance lointaine reste à venir", () => {
    expect(deadlineStatus({ status: "upcoming", dueDate: utcDate(2026, 7, 31), now })).toBe("upcoming");
  });

  it("la fenêtre d'alerte est paramétrable", () => {
    expect(deadlineStatus({ status: "upcoming", dueDate: utcDate(2026, 6, 25), now, amberDays: 5 })).toBe(
      "upcoming",
    );
    expect(deadlineStatus({ status: "upcoming", dueDate: utcDate(2026, 6, 25), now, amberDays: 30 })).toBe(
      "soon",
    );
  });

  it("le jour même de l'échéance n'est pas en retard", () => {
    expect(deadlineStatus({ status: "upcoming", dueDate: now, now })).toBe("soon");
  });
});
