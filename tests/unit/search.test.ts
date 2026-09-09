import { describe, expect, it } from "vitest";
import {
  buildSearchKey,
  matchRank,
  matchesTerms,
  normalizeSearch,
  searchTerms,
} from "@/lib/search";

/**
 * Recherche.
 *
 * Le point de départ est un défaut constaté : `contains` étant sensible à la
 * casse sur SQLite, chercher « atlas » ne trouvait pas « Atlas Distribution ».
 * La normalisation est donc appliquée des deux côtés, à l'écriture comme à la
 * requête.
 */
describe("normalisation", () => {
  it("ignore la casse", () => {
    expect(normalizeSearch("Atlas Distribution")).toBe("atlas distribution");
  });

  it("ignore les accents", () => {
    // « Meknès » et « Meknes » doivent se trouver l'un l'autre.
    expect(normalizeSearch("Meknès")).toBe(normalizeSearch("Meknes"));
    expect(normalizeSearch("Coopérative")).toBe("cooperative");
  });

  it("resserre les espaces", () => {
    expect(normalizeSearch("  Souss   Agro  ")).toBe("souss agro");
  });
});

describe("clé de recherche", () => {
  it("réunit les champs utiles", () => {
    const key = buildSearchKey("Atlas Distribution SARL", "002233445000077", "RC-11223", null);
    expect(key).toContain("atlas distribution sarl");
    expect(key).toContain("002233445000077");
    expect(key).toContain("rc-11223");
  });

  it("écarte les valeurs vides et les doublons", () => {
    expect(buildSearchKey("Atlas", "", null, undefined, "atlas", "ATLAS")).toBe("atlas");
  });
});

describe("filtrage", () => {
  const key = buildSearchKey("Meknès Textile SARL", "003344556000011", "0535112233", "Meknès");

  it("trouve quelle que soit la casse ou les accents", () => {
    for (const query of ["meknes", "MEKNÈS", "Meknes textile"]) {
      expect(matchesTerms(key, searchTerms(query))).toBe(true);
    }
  });

  it("trouve par ICE et par téléphone", () => {
    expect(matchesTerms(key, searchTerms("003344556000011"))).toBe(true);
    expect(matchesTerms(key, searchTerms("0535112233"))).toBe(true);
  });

  it("exige tous les termes, dans n'importe quel ordre", () => {
    expect(matchesTerms(key, searchTerms("textile meknes"))).toBe(true);
    expect(matchesTerms(key, searchTerms("meknes casablanca"))).toBe(false);
  });
});

describe("classement des résultats", () => {
  const rank = (label: string, query: string) =>
    matchRank(label, buildSearchKey(label), searchTerms(query));

  it("place d'abord les noms qui commencent par la saisie", () => {
    // Taper « M » doit donner Miracle et Meknès avant Souss Agro.
    expect(rank("Miracle", "m")).toBeLessThan(rank("Café Riad Zitoun", "m"));
    expect(rank("Meknès Textile", "m")).toBe(0);
  });

  it("place ensuite un mot du nom qui commence par la saisie", () => {
    expect(rank("Atlas Distribution", "dis")).toBe(1);
    expect(rank("Atlas Distribution", "atl")).toBe(0);
  });

  it("place en dernier une correspondance qui ne touche pas le nom", () => {
    const key = buildSearchKey("Atlas Distribution", "002233445000077");
    expect(matchRank("Atlas Distribution", key, searchTerms("00223"))).toBe(3);
  });

  it("ne classe rien quand la saisie est vide", () => {
    expect(rank("Atlas Distribution", "")).toBe(3);
  });
});
