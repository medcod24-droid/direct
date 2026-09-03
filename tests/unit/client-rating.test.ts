import { describe, expect, it } from "vitest";
import { rateClient, volumePercentile, type InvoiceFact } from "@/lib/clients/rating";

const NOW = new Date("2026-09-03T00:00:00Z");
const d = (iso: string) => new Date(`${iso}T00:00:00Z`);

/** Facture réglée `delay` jours après l'échéance (négatif = en avance). */
function settled(due: string, delay: number, amount = 100_000): InvoiceFact {
  const dueDate = d(due);
  return {
    amount,
    paidAmount: amount,
    dueDate,
    paidAt: new Date(dueDate.getTime() + delay * 86400000),
    status: "paid",
  };
}

/** Facture échue jamais réglée. */
function unpaid(due: string, amount = 100_000): InvoiceFact {
  return { amount, paidAmount: 0, dueDate: d(due), paidAt: null, status: "pending" };
}

const rate = (invoices: InvoiceFact[], percentile: number | null = 0.9) =>
  rateClient({ invoices, volumePercentile: percentile, now: NOW });

describe("note du dossier client", () => {
  describe("les quatre situations à distinguer", () => {
    it("paie à l'heure et gros volume : 5 étoiles", () => {
      const r = rate([settled("2026-03-10", -2), settled("2026-05-10", 0), settled("2026-07-10", -5)], 0.95);
      expect(r.stars).toBe(5);
      expect(r.punctuality).toBe(3);
      expect(r.volume).toBe(2);
    });

    it("gros volume mais paie en retard : note abaissée", () => {
      const r = rate([settled("2026-03-10", 25), settled("2026-05-10", 30), settled("2026-07-10", 18)], 0.95);
      expect(r.punctuality).toBe(0);
      expect(r.volume).toBe(2);
      expect(r.stars).toBe(2);
    });

    it("petit volume mais paie à l'heure : passe devant le gros mauvais payeur", () => {
      const petit = rate([settled("2026-03-10", 0), settled("2026-05-10", -1)], 0.1);
      const gros = rate([settled("2026-03-10", 25), settled("2026-05-10", 30)], 0.95);
      expect(petit.stars).toBe(3);
      expect(petit.stars! > gros.stars!).toBe(true);
    });

    it("petit volume et paie en retard : 1 étoile", () => {
      const r = rate([settled("2026-03-10", 40), settled("2026-05-10", 35)], 0.1);
      expect(r.stars).toBe(1);
    });
  });

  describe("impayés en cours", () => {
    it("une facture échue non réglée retire un point", () => {
      const propre = rate([settled("2026-03-10", 0), settled("2026-05-10", 0)], 0.9);
      const avecImpaye = rate([settled("2026-03-10", 0), settled("2026-05-10", 0), unpaid("2026-08-01")], 0.9);
      expect(avecImpaye.punctuality).toBe(propre.punctuality - 1);
      expect(avecImpaye.overdueCount).toBe(1);
    });

    it("un impayé de plus de 60 jours en retire deux", () => {
      const r = rate([settled("2026-03-10", 0), settled("2026-05-10", 0), unpaid("2026-05-01")], 0.9);
      expect(r.worstOverdueDays).toBeGreaterThan(60);
      expect(r.punctuality).toBe(1);
    });

    it("une facture échue rend un dossier notable même sans historique réglé", () => {
      const r = rate([unpaid("2026-07-01")], 0.5);
      expect(r.stars).not.toBeNull();
    });
  });

  describe("dossiers sans historique", () => {
    it("un dossier neuf n'est pas noté plutôt que mal noté", () => {
      expect(rate([]).stars).toBeNull();
      expect(rate([]).reasons[0]).toContain("pas encore d'historique");
    });

    it("une seule facture réglée ne suffit pas à juger", () => {
      expect(rate([settled("2026-05-10", 0)]).stars).toBeNull();
    });

    it("une facture non encore échue ne pénalise pas", () => {
      const r = rateClient({
        invoices: [settled("2026-03-10", 0), settled("2026-05-10", 0), unpaid("2026-12-01")],
        volumePercentile: 0.9,
        now: NOW,
      });
      expect(r.overdueCount).toBe(0);
      expect(r.stars).toBe(5);
    });
  });

  describe("détails calculés", () => {
    it("ignore les factures annulées", () => {
      const annulee: InvoiceFact = { amount: 999, paidAmount: 0, dueDate: d("2026-01-01"), paidAt: null, status: "cancelled" };
      const r = rate([settled("2026-03-10", 0), settled("2026-05-10", 0), annulee], 0.9);
      expect(r.overdueCount).toBe(0);
      expect(r.stars).toBe(5);
    });

    it("calcule le retard moyen sur les seules factures en retard", () => {
      const r = rate([settled("2026-03-10", 10), settled("2026-05-10", 20), settled("2026-07-10", 0)], 0.5);
      expect(r.averageDelayDays).toBe(15);
      expect(r.onTimeRatio).toBeCloseTo(1 / 3);
    });

    it("une facture réglée partiellement reste due", () => {
      const partielle: InvoiceFact = {
        amount: 100_000, paidAmount: 40_000, dueDate: d("2026-06-01"),
        paidAt: d("2026-06-01"), status: "partial",
      };
      const r = rate([settled("2026-03-10", 0), partielle], 0.5);
      expect(r.overdueCount).toBe(1);
    });
  });

  describe("percentile de volume", () => {
    it("situe un montant dans la distribution du cabinet", () => {
      const amounts = [10, 20, 30, 40, 50];
      expect(volumePercentile(50, amounts)).toBe(1);
      expect(volumePercentile(30, amounts)).toBe(0.5);
      expect(volumePercentile(10, amounts)).toBe(0);
    });

    it("le plus gros dossier atteint le palier haut même dans un petit cabinet", () => {
      // Trois dossiers seulement : le meilleur doit pouvoir viser cinq étoiles.
      expect(volumePercentile(300, [100, 200, 300])).toBe(1);
    });

    it("ne compare pas un cabinet qui n'a pas de quoi comparer", () => {
      expect(volumePercentile(100, [100])).toBeNull();
      expect(volumePercentile(100, [])).toBeNull();
    });
  });
});
