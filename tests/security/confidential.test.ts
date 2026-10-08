import { beforeAll, describe, expect, it } from "vitest";
import type { AuthContext } from "@/lib/authz/guard";
import { can } from "@/lib/authz/permissions";
import type { Role } from "@/lib/domain/enums";
import { tenantDb } from "@/lib/db/tenant";
import { NotFoundError } from "@/lib/errors";
import { createClient, listClients, updateClient } from "@/server/services/clients";
import { makeCabinet, makeUser } from "../factories";

/**
 * Dossiers confidentiels.
 *
 * Réservés à l'administration : le dossier **et ce qui s'y rattache** sortent de
 * la vue du reste de l'équipe, y compris pour un collaborateur qui a accès à
 * tous les dossiers. Le filtre est posé dans `tenantDb`, pas dans les écrans :
 * c'est ce que ces essais vérifient, en interrogeant la base à travers le
 * contexte plutôt que les pages.
 */
function contextFor(
  cabinetId: string,
  userId: string,
  role: Role,
  options: { clientIds?: string[] | null } = {},
): AuthContext {
  const voitConfidentiels = role === "client" || can(role, "client.confidential");
  const scope = {
    cabinetId,
    clientIds: options.clientIds ?? null,
    confidentialClients: voitConfidentiels,
  };
  return {
    sessionId: "test",
    user: { id: userId, email: "t@directconseil.ma", name: "Test", locale: "fr" },
    cabinet: { id: cabinetId, name: "Cabinet", slug: "c", cndpMode: "declaration" },
    membership: { id: "m", role, restrictedToAssigned: false, clientId: null },
    scope,
    db: tenantDb(scope),
    ip: null,
    userAgent: "vitest",
    can: (p) => can(role, p),
  };
}

const BASE = {
  kind: "company" as const,
  subtype: "sarl" as const,
  vatRegime: "quarterly",
  taxRegime: "is",
  takeoverDate: "2026-01-01",
};

describe("dossier confidentiel", () => {
  let admin: AuthContext;
  let comptable: AuthContext;
  let secretId: string;
  let ordinaireId: string;

  beforeAll(async () => {
    const [cabinet, user] = await Promise.all([makeCabinet("Confidentiel"), makeUser()]);
    admin = contextFor(cabinet.id, user.id, "admin");
    comptable = contextFor(cabinet.id, user.id, "accountant");

    const secret = await createClient(admin, {
      ...BASE,
      legalName: "Dossier réservé SARL",
      confidential: true,
    });
    secretId = secret.id;
    const ordinaire = await createClient(admin, { ...BASE, legalName: "Dossier ouvert SARL" });
    ordinaireId = ordinaire.id;

    // Une pièce rattachée au dossier réservé, pour vérifier qu'elle suit son sort.
    await admin.db.contact.create({
      data: { clientId: secretId, name: "Contact du dossier réservé", cabinetId: cabinet.id },
    });
  });

  it("n'apparaît pas dans la liste du comptable", async () => {
    const vus = await listClients(comptable, {});
    const noms = vus.items.map((row) => row.legalName);
    expect(noms).toContain("Dossier ouvert SARL");
    expect(noms).not.toContain("Dossier réservé SARL");
  });

  it("reste introuvable même avec son identifiant", async () => {
    expect(await comptable.db.client.findFirst({ where: { id: secretId } })).toBeNull();
    await expect(updateClient(comptable, secretId, { city: "Fès" })).rejects.toBeInstanceOf(
      NotFoundError,
    );
  });

  it("emporte ce qui s'y rattache", async () => {
    const contacts = await comptable.db.contact.findMany({});
    expect(contacts.map((row) => row.name)).not.toContain("Contact du dossier réservé");
    expect(await comptable.db.contact.count({ where: { clientId: secretId } })).toBe(0);
  });

  it("reste visible pour l'administration", async () => {
    const vus = await listClients(admin, {});
    expect(vus.items.map((row) => row.legalName)).toContain("Dossier réservé SARL");
    expect(await admin.db.contact.count({ where: { clientId: secretId } })).toBe(1);
  });

  it("ne se marque pas sans le droit, et ne se démarque pas davantage", async () => {
    // Le comptable voit ce dossier-là : il peut l'enregistrer, mais la case est ignorée.
    const apresComptable = await updateClient(comptable, ordinaireId, { confidential: true });
    expect(apresComptable.confidential).toBe(false);

    const marque = await updateClient(admin, ordinaireId, { confidential: true });
    expect(marque.confidential).toBe(true);
    // Désormais invisible pour lui, il ne peut plus le démarquer.
    await expect(
      updateClient(comptable, ordinaireId, { confidential: false }),
    ).rejects.toBeInstanceOf(NotFoundError);

    const rendu = await updateClient(admin, ordinaireId, { confidential: false });
    expect(rendu.confidential).toBe(false);
  });

  it("reste visible pour le compte client du portail", async () => {
    const portail = contextFor(admin.cabinet.id, "client-user", "client", {
      clientIds: [secretId],
    });
    expect(await portail.db.client.findFirst({ where: { id: secretId } })).not.toBeNull();
  });
});
