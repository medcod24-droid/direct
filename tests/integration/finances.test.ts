import { beforeAll, describe, expect, it } from "vitest";
import type { AuthContext } from "@/lib/authz/guard";
import { can } from "@/lib/authz/permissions";
import { platformDb, tenantDb } from "@/lib/db/tenant";
import { getYearResults, listResultYears, saveMonthlyResult } from "@/server/services/finances";
import { makeCabinet, makeClient, makeUser } from "../factories";

/**
 * Résultat mensuel du cabinet.
 *
 * Deux choses comptent : un mois se corrige sans se dédoubler, et le cumul suit
 * l'exercice — c'est ainsi qu'un comptable lit ses propres comptes.
 */
function contextFor(cabinetId: string, userId: string): AuthContext {
  const scope = { cabinetId, clientIds: null };
  return {
    sessionId: "test",
    user: { id: userId, email: "t@directconseil.ma", name: "Test", locale: "fr" },
    cabinet: { id: cabinetId, name: "Cabinet", slug: "c", cndpMode: "declaration" },
    membership: { id: "m", role: "owner", restrictedToAssigned: false, clientId: null },
    scope,
    db: tenantDb(scope),
    ip: null,
    userAgent: "vitest",
    can: (p) => can("owner", p),
  };
}

describe("résultat du cabinet", () => {
  let ctx: AuthContext;
  let autre: AuthContext;

  beforeAll(async () => {
    const [cabinet, cabinetB, user] = await Promise.all([
      makeCabinet("Résultat"),
      makeCabinet("Résultat bis"),
      makeUser(),
    ]);
    ctx = contextFor(cabinet.id, user.id);
    autre = contextFor(cabinetB.id, user.id);
  });

  it("enregistre un mois en centimes", async () => {
    const saved = await saveMonthlyResult(ctx, {
      month: "2026-01",
      revenue: 4_200_000,
      expenses: 3_100_000,
    });

    expect(saved.revenue).toBe(4_200_000);
    expect(saved.month.toISOString()).toBe("2026-01-01T00:00:00.000Z");
  });

  it("corrige un mois au lieu de le dédoubler", async () => {
    await saveMonthlyResult(ctx, { month: "2026-01", revenue: 5_000_000, expenses: 3_100_000 });

    const rows = await platformDb.monthlyResult.findMany({
      where: { cabinetId: ctx.cabinet.id, month: new Date("2026-01-01T00:00:00.000Z") },
    });
    expect(rows).toHaveLength(1);
    expect(rows[0]?.revenue).toBe(5_000_000);
  });

  it("refuse un mois mal formé", async () => {
    for (const month of ["2026-13", "janvier", "2026", ""]) {
      await expect(
        saveMonthlyResult(ctx, { month, revenue: 0, expenses: 0 }),
      ).rejects.toThrow();
    }
  });

  it("rend les douze mois, saisis ou non, avec le cumul", async () => {
    await saveMonthlyResult(ctx, { month: "2026-02", revenue: 2_000_000, expenses: 3_000_000 });

    const data = await getYearResults(ctx, 2026);
    expect(data.months).toHaveLength(12);

    const janvier = data.months[0];
    const fevrier = data.months[1];
    const mars = data.months[2];

    expect(janvier?.result).toBe(1_900_000);
    // Février est déficitaire : le cumul recule.
    expect(fevrier?.result).toBe(-1_000_000);
    expect(fevrier?.cumulative).toBe(900_000);

    // Un mois non saisi est rendu à zéro, et signalé comme tel.
    expect(mars?.filled).toBe(false);
    expect(mars?.cumulative).toBe(900_000);

    expect(data.totals.monthsFilled).toBe(2);
    expect(data.totals.result).toBe(900_000);
    // La moyenne porte sur les mois saisis, pas sur douze.
    expect(data.average).toBe(450_000);
    expect(data.best?.label).toBe("Janvier");
    expect(data.worst?.label).toBe("Février");
  });

  it("rappelle les honoraires facturés du mois, sans les reprendre", async () => {
    const client = await makeClient(ctx.cabinet.id);
    await platformDb.clientInvoice.create({
      data: {
        cabinetId: ctx.cabinet.id,
        clientId: client.id,
        reference: "F-2026-04",
        label: "Honoraires avril",
        amount: 1_234_500,
        paidAmount: 0,
        issuedAt: new Date("2026-04-10T00:00:00.000Z"),
        dueDate: new Date("2026-05-10T00:00:00.000Z"),
        status: "pending",
      },
    });

    const data = await getYearResults(ctx, 2026);
    const avril = data.months[3];
    expect(avril?.invoiced).toBe(1_234_500);
    // Le repère ne remplit rien : avril reste à saisir.
    expect(avril?.filled).toBe(false);
    expect(avril?.revenue).toBe(0);
  });

  it("reste invisible depuis un autre cabinet", async () => {
    const data = await getYearResults(autre, 2026);
    expect(data.totals.monthsFilled).toBe(0);
  });

  it("propose toujours l'année en cours dans la liste", async () => {
    const years = await listResultYears(ctx, new Date("2027-03-01T00:00:00.000Z"));
    expect(years).toContain(2027);
    expect(years).toContain(2026);
    // De la plus récente à la plus ancienne.
    expect([...years].sort((a, b) => b - a)).toEqual(years);
  });
});
