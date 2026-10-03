import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { verifyPassword } from "@/lib/auth/password";
import { platformDb } from "@/lib/db/tenant";
import { ValidationError } from "@/lib/errors";
import { requestPasswordReset, resetPassword } from "@/server/services/password-reset";
import { makeUser } from "../factories";

/**
 * Mot de passe oublié.
 *
 * Le transport « console » écrit le message dans les logs : les essais y lisent
 * le lien, ce qui vérifie la chaîne entière — jeton émis, courriel rédigé, lien
 * utilisable — plutôt que la seule écriture en base.
 */
function lienDuCourriel(spy: ReturnType<typeof vi.spyOn>): string | null {
  for (const appel of spy.mock.calls) {
    const texte = String(appel[0] ?? "");
    const trouve = /\/mot-de-passe\/reinitialiser\?jeton=([A-Za-z0-9_-]+)/.exec(texte);
    if (trouve) return trouve[1] ?? null;
  }
  return null;
}

async function demanderEtLireLeJeton(email: string): Promise<string | null> {
  const spy = vi.spyOn(console, "info").mockImplementation(() => undefined);
  try {
    await requestPasswordReset({ email }, { ip: "127.0.0.1", userAgent: "vitest" });
    return lienDuCourriel(spy);
  } finally {
    spy.mockRestore();
  }
}

describe("mot de passe oublié", () => {
  let email: string;
  let userId: string;

  beforeAll(async () => {
    const user = await makeUser();
    email = user.email;
    userId = user.id;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("ne dit pas si l'adresse existe, et n'émet rien pour un inconnu", async () => {
    await expect(
      requestPasswordReset({ email: "personne@directconseil.ma" }, {}),
    ).resolves.toBeUndefined();
    const jetons = await platformDb.passwordReset.count();
    const connus = await platformDb.user.count({ where: { email: "personne@directconseil.ma" } });
    expect(connus).toBe(0);
    expect(jetons).toBeGreaterThanOrEqual(0);
  });

  it("envoie un lien utilisable, qui change le mot de passe et ferme les sessions", async () => {
    await platformDb.session.create({
      data: {
        tokenHash: `session-${userId}`,
        userId,
        expiresAt: new Date(Date.now() + 3600_000),
      },
    });

    const jeton = await demanderEtLireLeJeton(email);
    expect(jeton).toBeTruthy();

    await resetPassword({ token: jeton, password: "Nouveau-Mot-2026" }, {});

    const user = await platformDb.user.findUniqueOrThrow({ where: { id: userId } });
    expect(await verifyPassword("Nouveau-Mot-2026", user.passwordHash)).toBe(true);
    expect(await platformDb.session.count({ where: { userId } })).toBe(0);
  });

  it("refuse le même lien une seconde fois", async () => {
    const jeton = await demanderEtLireLeJeton(email);
    await resetPassword({ token: jeton, password: "Encore-Un-Mot-2026" }, {});
    await expect(
      resetPassword({ token: jeton, password: "Troisieme-Mot-2026" }, {}),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("refuse un lien expiré", async () => {
    const jeton = await demanderEtLireLeJeton(email);
    await platformDb.passwordReset.updateMany({
      where: { userId, usedAt: null },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });
    await expect(
      resetPassword({ token: jeton, password: "Expire-Mot-2026" }, {}),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("refuse un mot de passe faible sans consommer le lien", async () => {
    const jeton = await demanderEtLireLeJeton(email);
    // Assez long pour passer le schéma, mais sans majuscule ni chiffre : c'est la
    // politique de mot de passe qui le refuse, pas la validation du formulaire.
    await expect(
      resetPassword({ token: jeton, password: "motdepasseminuscule" }, {}),
    ).rejects.toBeInstanceOf(ValidationError);
    // Le lien reste utilisable : l'utilisateur corrige sa saisie.
    await expect(resetPassword({ token: jeton, password: "Correction-2026x" }, {})).resolves.toEqual(
      { email },
    );
  });

  it("ignore les demandes au-delà de cinq par heure", async () => {
    const autre = await makeUser();
    for (let i = 0; i < 5; i += 1) await requestPasswordReset({ email: autre.email }, {});
    const avant = await platformDb.passwordReset.count({ where: { userId: autre.id } });
    await requestPasswordReset({ email: autre.email }, {});
    const apres = await platformDb.passwordReset.count({ where: { userId: autre.id } });
    expect(avant).toBe(5);
    expect(apres).toBe(5);
  });
});
