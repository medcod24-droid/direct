import { describe, expect, it } from "vitest";
import { assertSafeKey, __testing } from "@/lib/storage/drivers";
import { ValidationError } from "@/lib/errors";

const { encrypt, decrypt } = __testing;

/**
 * Le stockage objet de Vercel ne sert que des URL publiques. Le contenu est donc
 * chiffré avant dépôt : l'adresse seule ne doit rien donner d'exploitable.
 */
describe("chiffrement du contenu déposé", () => {
  const clair = Buffer.from("Attestation de régularité fiscale — 2026");

  it("un aller-retour rend le contenu d'origine", () => {
    expect(decrypt(encrypt(clair)).equals(clair)).toBe(true);
  });

  it("le contenu chiffré ne laisse pas transparaître le clair", () => {
    const chiffre = encrypt(clair);
    expect(chiffre.includes(clair)).toBe(false);
    expect(chiffre.toString("utf8")).not.toContain("Attestation");
  });

  it("deux dépôts du même fichier donnent des contenus différents", () => {
    // Vecteur d'initialisation aléatoire : sans lui, deux documents identiques
    // seraient reconnaissables l'un à l'autre dans le stockage.
    expect(encrypt(clair).equals(encrypt(clair))).toBe(false);
  });

  it("un contenu modifié est rejeté au lieu d'être rendu tronqué", () => {
    const chiffre = encrypt(clair);
    chiffre[chiffre.length - 1] = (chiffre[chiffre.length - 1] ?? 0) ^ 0xff;
    expect(() => decrypt(chiffre)).toThrow();
  });

  it("un vecteur d'initialisation modifié est rejeté", () => {
    const chiffre = encrypt(clair);
    chiffre[0] = (chiffre[0] ?? 0) ^ 0xff;
    expect(() => decrypt(chiffre)).toThrow();
  });

  it("un contenu tronqué est refusé explicitement", () => {
    expect(() => decrypt(Buffer.alloc(4))).toThrow(ValidationError);
    expect(() => decrypt(Buffer.alloc(0))).toThrow(/tronqué/);
  });

  it("un fichier vide se chiffre et se déchiffre", () => {
    expect(decrypt(encrypt(Buffer.alloc(0))).length).toBe(0);
  });
});

describe("clés de stockage", () => {
  it("refuse toute clé sortant de la racine, quel que soit le pilote", () => {
    for (const cle of ["../../../etc/passwd", "../secret.bin", "/etc/passwd", "..", "../"]) {
      expect(() => assertSafeKey(cle)).toThrow(ValidationError);
    }
  });

  it("accepte une clé normale", () => {
    expect(assertSafeKey("cabinet123/2026/fichier.bin")).toBe("cabinet123/2026/fichier.bin");
  });
});
