import { describe, expect, it } from "vitest";
import { GET } from "@/app/api/health/route";
import { invalidEnvNames } from "@/lib/env";

/**
 * Une variable d'environnement manquante restait invisible : les pages
 * s'affichent, `env()` n'étant atteint qu'à la création d'une session. La sonde
 * doit donc valider la configuration, sans jamais divulguer de valeur.
 */
describe("sonde de santé", () => {
  it("répond « ok » quand la configuration et la base sont saines", async () => {
    const response = await GET();
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body).toMatchObject({ status: "ok", config: "ok", database: "ok" });
    expect(body.invalidEnv).toBeUndefined();
  });

  it("extrait les noms des variables refusées", () => {
    const error = new Error(
      "Configuration invalide. Variables manquantes ou invalides : APP_SECRET, APP_URL. Voir .env.example.",
    );
    expect(invalidEnvNames(error)).toEqual(["APP_SECRET", "APP_URL"]);
  });

  it("n'extrait aucune valeur, seulement des noms", () => {
    const error = new Error(
      "Configuration invalide. Variables manquantes ou invalides : APP_SECRET. Voir .env.example.",
    );
    const noms = invalidEnvNames(error);
    expect(noms).toEqual(["APP_SECRET"]);
    expect(noms.join()).not.toMatch(/=|:\/\//);
  });

  it("ne renvoie rien pour une erreur d'une autre nature", () => {
    expect(invalidEnvNames(new Error("connexion refusée"))).toEqual([]);
    expect(invalidEnvNames("pas une erreur")).toEqual([]);
  });
});

describe("variables d'environnement vides", () => {
  it("une variable vide retombe sur sa valeur par défaut", async () => {
    const avant = { storage: process.env.STORAGE_ROOT, upload: process.env.MAX_UPLOAD_MB };
    process.env.STORAGE_ROOT = "";
    process.env.MAX_UPLOAD_MB = "  ";
    try {
      // Un hébergeur crée facilement une variable sans valeur : elle doit valoir
      // « non définie », pas invalider toute la configuration.
      const response = await GET();
      const body = await response.json();
      expect(body.config).toBe("ok");
      expect(body.invalidEnv).toBeUndefined();
    } finally {
      if (avant.storage === undefined) delete process.env.STORAGE_ROOT;
      else process.env.STORAGE_ROOT = avant.storage;
      if (avant.upload === undefined) delete process.env.MAX_UPLOAD_MB;
      else process.env.MAX_UPLOAD_MB = avant.upload;
    }
  });
});
