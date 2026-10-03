import { describe, expect, it } from "vitest";
import { mailStatus } from "@/lib/mail/send";

/**
 * État d'envoi des courriels, exposé par la sonde de santé.
 *
 * Ce qui doit se voir : une production restée en « console » n'envoie rien — le
 * mot de passe oublié y est inutilisable — et un fournisseur choisi sans sa clé
 * est une configuration incomplète.
 */
describe("état du courriel", () => {
  it("accepte le mode console en développement, le signale en production", () => {
    expect(mailStatus({ EMAIL_PROVIDER: "console" }, false)).toBe("ok");
    expect(mailStatus({ EMAIL_PROVIDER: "console" }, true)).toBe("console");
  });

  it("exige la clé du fournisseur HTTP", () => {
    expect(mailStatus({ EMAIL_PROVIDER: "resend", RESEND_API_KEY: "re_xxx" }, true)).toBe("ok");
    expect(mailStatus({ EMAIL_PROVIDER: "resend" }, true)).toBe("incomplet");
  });

  it("exige l'adresse du serveur SMTP", () => {
    expect(mailStatus({ EMAIL_PROVIDER: "smtp", SMTP_URL: "smtps://a:b@c:465" }, true)).toBe("ok");
    expect(mailStatus({ EMAIL_PROVIDER: "smtp" }, true)).toBe("incomplet");
  });
});
