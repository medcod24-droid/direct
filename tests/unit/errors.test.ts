import { describe, expect, it } from "vitest";
import { z } from "zod";
import { ForbiddenError, toPublicError, ValidationError } from "@/lib/errors";
import { clientSchema } from "@/lib/validation/schemas";

describe("toPublicError", () => {
  it("conserve le message de validation d'un ZodError au lieu de l'écraser", () => {
    let thrown: unknown;
    try {
      clientSchema.parse({
        kind: "company",
        subtype: "sarl",
        legalName: "Test SARL",
        ice: "123",
        takeoverDate: "2026-09-02",
      });
    } catch (error) {
      thrown = error;
    }

    const result = toPublicError(thrown);
    expect(result.status).toBe(422);
    expect(result.code).toBe("validation");
    expect(result.message).toContain("15 chiffres");
    expect(result.message).not.toContain("inattendue");
    expect(result.fieldErrors?.ice?.[0]).toContain("15 chiffres");
  });

  it("regroupe les messages par champ et signale le surplus", () => {
    const schema = z.object({
      a: z.string().min(1, "A requis."),
      b: z.string().min(1, "B requis."),
      c: z.string().min(1, "C requis."),
      d: z.string().min(1, "D requis."),
    });
    const result = toPublicError(
      (() => {
        try {
          schema.parse({ a: "", b: "", c: "", d: "" });
        } catch (e) {
          return e;
        }
      })(),
    );
    expect(result.message).toContain("A requis.");
    expect(result.message).toContain("(+1 autre)");
    expect(Object.keys(result.fieldErrors ?? {})).toEqual(["a", "b", "c", "d"]);
  });

  it("expose les fieldErrors d'une ValidationError applicative", () => {
    const result = toPublicError(new ValidationError("Champ invalide.", { ice: ["Trop court."] }));
    expect(result.message).toBe("Champ invalide.");
    expect(result.fieldErrors?.ice).toEqual(["Trop court."]);
  });

  it("garde le message public des autres AppError", () => {
    expect(toPublicError(new ForbiddenError()).message).toContain("autorisation");
  });

  it("masque une erreur technique inconnue", () => {
    const result = toPublicError(new Error("colonne SQL manquante"));
    expect(result.status).toBe(500);
    expect(result.message).toContain("inattendue");
    expect(result.message).not.toContain("SQL");
  });
});
