import { describe, expect, it } from "vitest";
import { fromZodError } from "@/lib/errors";
import { parseMadInput } from "@/lib/format";
import { invoiceSchema } from "@/lib/validation/schemas";
import { invoiceStatus } from "@/server/services/invoices";

/**
 * Saisie du comptable : montants, messages, statuts.
 *
 * Trois défauts relevés en revue avant la mise en service : une virgule
 * décimale refusée, des messages de validation en anglais, et des factures
 * échues affichées « en attente ».
 */
describe("montant saisi en dirhams", () => {
  it("accepte la virgule décimale et les espaces de milliers", () => {
    expect(parseMadInput("1 500,50")).toBe(150050);
    expect(parseMadInput("1 500,5")).toBe(150050);
    expect(parseMadInput("2500")).toBe(250000);
  });

  it("arrondit au centime sans erreur de virgule flottante", () => {
    expect(parseMadInput("19.99")).toBe(1999);
    expect(parseMadInput("0,07")).toBe(7);
    expect(Number.isInteger(parseMadInput("1234.56"))).toBe(true);
  });

  it("distingue une saisie vide d'une saisie illisible", () => {
    expect(parseMadInput("")).toBeUndefined();
    expect(parseMadInput("   ")).toBeUndefined();
    expect(parseMadInput(undefined)).toBeUndefined();
    expect(parseMadInput("douze")).toBeNaN();
    expect(parseMadInput("1,500,50")).toBeNaN();
  });
});

describe("messages de validation", () => {
  it("sont en français quand le schéma n'en donne pas", () => {
    const result = invoiceSchema.safeParse({
      reference: "2026-0001",
      amount: Number.NaN,
      issuedAt: "pas une date",
      dueDate: "2026-10-01",
    });
    expect(result.success).toBe(false);
    if (result.success) return;

    const { fieldErrors } = fromZodError(result.error);
    expect(fieldErrors.clientId).toEqual(["Champ requis."]);
    expect(fieldErrors.amount).toEqual(["Nombre invalide."]);
    expect(fieldErrors.issuedAt).toEqual(["Date invalide."]);

    const all = Object.values(fieldErrors).flat().join(" ");
    expect(all).not.toMatch(/Required|Expected|Invalid|received/);
  });

  it("gardent le message propre au schéma quand il en donne un", () => {
    const result = invoiceSchema.safeParse({
      clientId: "c1",
      reference: "",
      amount: 100,
      issuedAt: "2026-09-01",
      dueDate: "2026-10-01",
    });
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(fromZodError(result.error).fieldErrors.reference).toEqual(["Référence requise."]);
  });
});

describe("statut affiché d'une facture", () => {
  const now = new Date("2026-09-15T10:00:00Z");
  const past = new Date("2026-09-01T00:00:00Z");
  const future = new Date("2026-10-01T00:00:00Z");

  it("passe en retard dès l'échéance dépassée, sans tâche de fond", () => {
    expect(invoiceStatus({ status: "pending", dueDate: past }, now)).toBe("overdue");
    expect(invoiceStatus({ status: "partial", dueDate: past }, now)).toBe("overdue");
  });

  it("ne touche ni aux factures à venir, ni aux soldées, ni aux annulées", () => {
    expect(invoiceStatus({ status: "pending", dueDate: future }, now)).toBe("pending");
    expect(invoiceStatus({ status: "paid", dueDate: past }, now)).toBe("paid");
    expect(invoiceStatus({ status: "cancelled", dueDate: past }, now)).toBe("cancelled");
  });
});
