import { beforeAll, describe, expect, it } from "vitest";
import type { AuthContext } from "@/lib/authz/guard";
import { can } from "@/lib/authz/permissions";
import { platformDb, tenantDb } from "@/lib/db/tenant";
import { fieldScans, replaceFieldScan } from "@/server/services/documents";
import { makeCabinet, makeClient, makeUser } from "../factories";

/**
 * Justificatifs rattachés aux champs de la fiche.
 *
 * Ce qui compte ici est le remplacement : la fiche montre la pièce en cours, pas
 * un historique. Un dépôt qui laisserait l'ancienne derrière lui ferait grossir
 * le stockage du cabinet sans que rien ne l'affiche.
 */
function contextFor(cabinetId: string, userId: string): AuthContext {
  const scope = { cabinetId, clientIds: null };
  return {
    sessionId: "test",
    user: { id: userId, email: "t@directconseil.ma", name: "Test", locale: "fr" },
    cabinet: { id: cabinetId, name: "Cabinet", slug: "c", cndpMode: "declaration" },
    membership: { id: "m", role: "owner", restrictedToAssigned: false, clientId: null },
    scope,
    db: tenantDb(scope),
    ip: null,
    userAgent: "vitest",
    can: (p) => can("owner", p),
  };
}

const pdf = (name: string) => ({
  name,
  type: "application/pdf",
  buffer: Buffer.from("%PDF-1.4\n"),
});

describe("justificatifs de champ", () => {
  let ctx: AuthContext;
  let clientId: string;

  beforeAll(async () => {
    const cabinet = await makeCabinet("Justificatifs");
    const user = await makeUser();
    const client = await makeClient(cabinet.id);
    clientId = client.id;
    ctx = contextFor(cabinet.id, user.id);
  });

  it("rattache la pièce au champ", async () => {
    const document = await replaceFieldScan(ctx, { clientId, fieldKey: "ice" }, pdf("ice.pdf"));
    expect(document.fieldKey).toBe("ice");

    const scans = await fieldScans(ctx, clientId);
    expect(scans.get("ice")?.filename).toBe("ice.pdf");
  });

  it("remplace la pièce précédente du même champ, et elle seule", async () => {
    await replaceFieldScan(ctx, { clientId, fieldKey: "if" }, pdf("if-v1.pdf"));
    await replaceFieldScan(ctx, { clientId, fieldKey: "if" }, pdf("if-v2.pdf"));

    const scans = await fieldScans(ctx, clientId);
    expect(scans.get("if")?.filename).toBe("if-v2.pdf");
    // L'ICE déposée au test précédent n'a pas bougé.
    expect(scans.get("ice")?.filename).toBe("ice.pdf");

    const remaining = await platformDb.document.count({ where: { clientId, fieldKey: "if" } });
    expect(remaining).toBe(1);
  });

  it("accepte une clé de ligne d'arbre", async () => {
    const document = await replaceFieldScan(
      ctx,
      { clientId, fieldKey: "tax:a1b2c3d4" },
      pdf("tp.pdf"),
    );
    expect(document.fieldKey).toBe("tax:a1b2c3d4");
  });

  it("refuse une clé de champ malformée", async () => {
    await expect(
      replaceFieldScan(ctx, { clientId, fieldKey: "../../etc/passwd" }, pdf("x.pdf")),
    ).rejects.toThrow();
  });

  it("refuse un dépôt sans dossier", async () => {
    await expect(
      replaceFieldScan(ctx, { fieldKey: "ice" }, pdf("x.pdf")),
    ).rejects.toThrow();
  });

  it("ne renvoie pas les pièces ordinaires du dossier", async () => {
    await platformDb.document.create({
      data: {
        cabinetId: ctx.cabinet.id,
        clientId,
        filename: "facture.pdf",
        storageKey: `test/${Date.now()}-facture`,
        mimeType: "application/pdf",
        size: 10,
        checksum: "x",
      },
    });

    const scans = await fieldScans(ctx, clientId);
    expect([...scans.values()].some((row) => row.filename === "facture.pdf")).toBe(false);
  });
});
