import { describe, expect, it } from "vitest";
import { assertPasswordPolicy, hashPassword, verifyPassword } from "@/lib/auth/password";
import { ValidationError } from "@/lib/errors";

/**
 * Tests de la politique de mot de passe et du hachage.
 *
 * Le hachage bcrypt est volontairement coûteux : on n'en fait qu'un aller-retour ici,
 * la politique se testant sans aucun appel cryptographique.
 */

const FORT = "Comptabilite2026!";

describe("assertPasswordPolicy", () => {
  it("accepte un mot de passe solide", () => {
    expect(() => assertPasswordPolicy(FORT)).not.toThrow();
    expect(() => assertPasswordPolicy("Fiduciaire-Rabat-2026")).not.toThrow();
    expect(() => assertPasswordPolicy(FORT, "rabia@daftar.ma")).not.toThrow();
  });

  it("refuse un mot de passe trop court", () => {
    expect(() => assertPasswordPolicy("Court1")).toThrow(ValidationError);
    expect(() => assertPasswordPolicy("Court1")).toThrow(/12 caractères/);
    // 11 caractères : juste en dessous de la limite.
    expect(() => assertPasswordPolicy("Abcdefghi1!")).toThrow(/12 caractères/);
    // 12 caractères : la limite est atteinte.
    expect(() => assertPasswordPolicy("Abcdefghij1!")).not.toThrow();
  });

  it("refuse un mot de passe sans majuscule", () => {
    expect(() => assertPasswordPolicy("comptabilite2026!")).toThrow(/majuscule/);
  });

  it("refuse un mot de passe sans minuscule", () => {
    expect(() => assertPasswordPolicy("COMPTABILITE2026!")).toThrow(/minuscule/);
  });

  it("refuse un mot de passe sans chiffre", () => {
    expect(() => assertPasswordPolicy("ComptabiliteRabat!")).toThrow(/chiffre/);
  });

  it("refuse un mot de passe de la liste noire, même réécrit en casse mixte", () => {
    expect(() => assertPasswordPolicy("Motdepasse123")).toThrow(/trop courant/);
    expect(() => assertPasswordPolicy("Comptable2026")).toThrow(/trop courant/);
    expect(() => assertPasswordPolicy("Daftar123456")).toThrow(/trop courant/);
  });

  it("refuse un mot de passe contenant l'identifiant de l'e-mail", () => {
    expect(() => assertPasswordPolicy("Rabia-Secret-2026", "rabia@daftar.ma")).toThrow(
      /votre identifiant/,
    );
    // La comparaison est insensible à la casse.
    expect(() => assertPasswordPolicy("Xx-RABIA-2026xx", "rabia@daftar.ma")).toThrow(
      /votre identifiant/,
    );
    // Seule la partie locale est comparée : le domaine ne compte pas.
    expect(() => assertPasswordPolicy("Daftar-Ma-2026x", "rabia@daftar.ma")).not.toThrow();
  });

  it("cumule les erreurs et les expose par champ", () => {
    try {
      assertPasswordPolicy("court");
      throw new Error("aurait dû échouer");
    } catch (error) {
      expect(error).toBeInstanceOf(ValidationError);
      const validation = error as ValidationError;
      expect(validation.status).toBe(422);
      expect(validation.fieldErrors.password).toHaveLength(3); // longueur, majuscule, chiffre
      expect(validation.publicMessage).toMatch(/majuscule/);
    }
  });
});

describe("hachage", () => {
  it("hache le mot de passe et vérifie l'aller-retour", async () => {
    const hash = await hashPassword(FORT);
    expect(hash).not.toBe(FORT);
    expect(hash).not.toContain(FORT);
    expect(hash).toMatch(/^\$2[aby]\$12\$/); // bcrypt, coût 12
    expect(await verifyPassword(FORT, hash)).toBe(true);
    expect(await verifyPassword("MauvaisMotDePasse2026", hash)).toBe(false);
  });

  it("deux hachages du même mot de passe diffèrent (sel aléatoire)", async () => {
    const [a, b] = await Promise.all([hashPassword(FORT), hashPassword(FORT)]);
    expect(a).not.toBe(b);
    expect(await verifyPassword(FORT, a)).toBe(true);
    expect(await verifyPassword(FORT, b)).toBe(true);
  });
});
