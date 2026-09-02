import { beforeAll, describe, expect, it } from "vitest";
import { platformDb, tenantDb } from "@/lib/db/tenant";
import { makeCabinet, makeClient, makeDocument } from "../factories";

/**
 * Tests d'isolation multi-tenant.
 *
 * Ils simulent exactement l'attaque décrite au cahier des charges : un utilisateur du
 * cabinet A qui connaît l'identifiant d'une ressource du cabinet B et le passe à l'API.
 * La réponse attendue est toujours « introuvable », jamais la donnée.
 */
describe("isolation multi-tenant", () => {
  let cabinetA: { id: string };
  let cabinetB: { id: string };
  let clientA: { id: string };
  let clientB: { id: string };
  let documentB: { id: string };

  beforeAll(async () => {
    cabinetA = await makeCabinet("Cabinet A");
    cabinetB = await makeCabinet("Cabinet B");
    clientA = await makeClient(cabinetA.id, { legalName: "Client du cabinet A" });
    clientB = await makeClient(cabinetB.id, { legalName: "Client du cabinet B" });
    documentB = await makeDocument(cabinetB.id, clientB.id);
  });

  it("refuse de construire un client sans cabinet", () => {
    // @ts-expect-error : appel volontairement invalide
    expect(() => tenantDb({})).toThrow(/cabinetId/);
    expect(() => tenantDb({ cabinetId: "" })).toThrow(/cabinetId/);
  });

  it("findMany ne renvoie que les données du cabinet", async () => {
    const db = tenantDb({ cabinetId: cabinetA.id });
    const clients = await db.client.findMany();
    expect(clients).toHaveLength(1);
    expect(clients[0]!.id).toBe(clientA.id);
  });

  it("findUnique sur un identifiant d'un autre cabinet renvoie null", async () => {
    const db = tenantDb({ cabinetId: cabinetA.id });
    expect(await db.client.findUnique({ where: { id: clientB.id } })).toBeNull();
    expect(await db.document.findUnique({ where: { id: documentB.id } })).toBeNull();
  });

  it("findFirst avec un where explicite ne contourne pas le filtre", async () => {
    const db = tenantDb({ cabinetId: cabinetA.id });
    // Tentative de contournement : on force le cabinetId de l'autre cabinet.
    const found = await db.client.findFirst({ where: { cabinetId: cabinetB.id } });
    expect(found).toBeNull();
  });

  it("update sur une ressource d'un autre cabinet n'affecte rien", async () => {
    const db = tenantDb({ cabinetId: cabinetA.id });
    await expect(
      db.client.update({ where: { id: clientB.id }, data: { legalName: "Piraté" } }),
    ).rejects.toThrow();

    const untouched = await platformDb.client.findUniqueOrThrow({ where: { id: clientB.id } });
    expect(untouched.legalName).toBe("Client du cabinet B");
  });

  it("updateMany et deleteMany restent bornés au cabinet", async () => {
    const db = tenantDb({ cabinetId: cabinetA.id });
    const updated = await db.client.updateMany({ data: { priority: "high" } });
    expect(updated.count).toBe(1);

    const deleted = await db.document.deleteMany({ where: { id: documentB.id } });
    expect(deleted.count).toBe(0);
    expect(await platformDb.document.findUnique({ where: { id: documentB.id } })).not.toBeNull();
  });

  it("delete sur une ressource d'un autre cabinet échoue", async () => {
    const db = tenantDb({ cabinetId: cabinetA.id });
    await expect(db.document.delete({ where: { id: documentB.id } })).rejects.toThrow();
    expect(await platformDb.document.findUnique({ where: { id: documentB.id } })).not.toBeNull();
  });

  it("create force le cabinet du contexte, même si un autre est fourni", async () => {
    const db = tenantDb({ cabinetId: cabinetA.id });
    const created = await db.client.create({
      data: {
        // Tentative d'injection : le cabinetId fourni doit être écrasé.
        cabinetId: cabinetB.id,
        kind: "company",
        subtype: "sarl",
        legalName: "Client injecté",
        takeoverDate: new Date("2026-01-01"),
      },
    });
    expect(created.cabinetId).toBe(cabinetA.id);
  });

  it("count et aggregate sont filtrés", async () => {
    const dbA = tenantDb({ cabinetId: cabinetA.id });
    const dbB = tenantDb({ cabinetId: cabinetB.id });
    expect(await dbA.client.count()).toBe(2); // le client initial + celui créé ci-dessus
    expect(await dbB.client.count()).toBe(1);
  });

  it("les catégories système restent lisibles mais non modifiables par un cabinet", async () => {
    const db = tenantDb({ cabinetId: cabinetA.id });
    const categories = await db.documentCategory.findMany();
    expect(categories.length).toBeGreaterThan(0);
    expect(categories.every((c) => c.cabinetId === null || c.cabinetId === cabinetA.id)).toBe(true);

    const systemCategory = categories.find((c) => c.cabinetId === null)!;
    const result = await db.documentCategory.updateMany({
      where: { id: systemCategory.id },
      data: { name: "Renommée" },
    });
    expect(result.count).toBe(0);

    const stillSystem = await platformDb.documentCategory.findUniqueOrThrow({
      where: { id: systemCategory.id },
    });
    expect(stillSystem.name).not.toBe("Renommée");
  });
});

describe("portée par dossier (collaborateur restreint et compte client)", () => {
  it("un collaborateur restreint ne voit que ses dossiers assignés", async () => {
    const cabinet = await makeCabinet("Cabinet Scope");
    const assigned = await makeClient(cabinet.id, { legalName: "Dossier assigné" });
    await makeClient(cabinet.id, { legalName: "Dossier non assigné" });
    const documentAssigned = await makeDocument(cabinet.id, assigned.id);

    const db = tenantDb({ cabinetId: cabinet.id, clientIds: [assigned.id] });

    const clients = await db.client.findMany();
    expect(clients.map((c) => c.legalName)).toEqual(["Dossier assigné"]);
    expect(await db.document.findUnique({ where: { id: documentAssigned.id } })).not.toBeNull();
  });

  it("un dossier non assigné est introuvable même par identifiant exact", async () => {
    const cabinet = await makeCabinet("Cabinet Scope 2");
    const assigned = await makeClient(cabinet.id);
    const other = await makeClient(cabinet.id);
    const documentOther = await makeDocument(cabinet.id, other.id);

    const db = tenantDb({ cabinetId: cabinet.id, clientIds: [assigned.id] });
    expect(await db.client.findUnique({ where: { id: other.id } })).toBeNull();
    expect(await db.document.findUnique({ where: { id: documentOther.id } })).toBeNull();
  });

  it("une portée vide ne donne accès à rien (refus par défaut)", async () => {
    const cabinet = await makeCabinet("Cabinet Scope 3");
    await makeClient(cabinet.id);
    const db = tenantDb({ cabinetId: cabinet.id, clientIds: [] });
    expect(await db.client.findMany()).toHaveLength(0);
  });

  it("les tâches internes sans dossier restent visibles d'un collaborateur restreint", async () => {
    const cabinet = await makeCabinet("Cabinet Scope 4");
    const assigned = await makeClient(cabinet.id);
    await platformDb.task.create({
      data: { cabinetId: cabinet.id, title: "Tâche interne", clientId: null },
    });
    await platformDb.task.create({
      data: { cabinetId: cabinet.id, title: "Tâche dossier", clientId: assigned.id },
    });

    const db = tenantDb({ cabinetId: cabinet.id, clientIds: [assigned.id] });
    const tasks = await db.task.findMany();
    expect(tasks.map((t) => t.title).sort()).toEqual(["Tâche dossier", "Tâche interne"]);
  });
});
