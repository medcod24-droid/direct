import { beforeAll, describe, expect, it } from "vitest";
import type { AuthContext } from "@/lib/authz/guard";
import { can } from "@/lib/authz/permissions";
import { platformDb, tenantDb } from "@/lib/db/tenant";
import { uploadDocument } from "@/server/services/documents";
import { makeCabinet, makeClient, makeUser } from "../factories";

/**
 * Dépôt en vrac : la rubrique « Autres documents » du dossier.
 *
 * Les fichiers partent un par un depuis l'écran ; ce qui se vérifie ici est le
 * rangement : chaque pièce arrive bien dans la catégorie fourre-tout, et la
 * rubrique les retrouve toutes — c'est la requête que fait la page.
 */
function contextFor(cabinetId: string, userId: string): AuthContext {
  const scope = { cabinetId, clientIds: null, confidentialClients: true };
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

describe("autres documents", () => {
  let ctx: AuthContext;
  let clientId: string;
  let categorieId: string;

  beforeAll(async () => {
    const [cabinet, user] = await Promise.all([makeCabinet("Vrac"), makeUser()]);
    const client = await makeClient(cabinet.id);
    clientId = client.id;
    ctx = contextFor(cabinet.id, user.id);

    // Catégorie système (cabinetId null) : Prisma refuse une clé composée dont
    // une part est nulle, d'où la recherche puis la création plutôt qu'un upsert.
    const existante = await platformDb.documentCategory.findFirst({
      where: { cabinetId: null, code: "autres" },
    });
    const categorie =
      existante ??
      (await platformDb.documentCategory.create({
        data: { cabinetId: null, code: "autres", name: "Autres documents", kind: "other" },
      }));
    categorieId = categorie.id;
  });

  it("range chaque pièce déposée dans la catégorie fourre-tout", async () => {
    for (const nom of ["contrat.pdf", "courrier.pdf", "releve.pdf"]) {
      await uploadDocument(ctx, { clientId, categoryId: categorieId }, pdf(nom));
    }

    const rangés = await ctx.db.document.findMany({
      where: { clientId, category: { is: { code: "autres" } } },
      orderBy: { createdAt: "desc" },
      select: { filename: true, categoryId: true },
    });

    expect(rangés).toHaveLength(3);
    expect(rangés.map((row) => row.filename).sort()).toEqual([
      "contrat.pdf",
      "courrier.pdf",
      "releve.pdf",
    ]);
    expect(rangés.every((row) => row.categoryId === categorieId)).toBe(true);
  });

  it("laisse hors de la rubrique les pièces classées ailleurs", async () => {
    await uploadDocument(ctx, { clientId }, pdf("sans-categorie.pdf"));
    const rangés = await ctx.db.document.findMany({
      where: { clientId, category: { is: { code: "autres" } } },
      select: { filename: true },
    });
    expect(rangés.map((row) => row.filename)).not.toContain("sans-categorie.pdf");
  });
});
