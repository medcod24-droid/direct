import { beforeAll, describe, expect, it } from "vitest";
import type { AuthContext } from "@/lib/authz/guard";
import { can } from "@/lib/authz/permissions";
import { tenantDb } from "@/lib/db/tenant";
import {
  createIntervention,
  deleteIntervention,
  listInterventions,
  updateIntervention,
} from "@/server/services/interventions";
import { makeCabinet, makeClient, makeUser } from "../factories";

/**
 * Registre des services rendus.
 *
 * Il est saisi à la main et ne se déduit d'aucune autre table : ce qui compte
 * ici est qu'il reste dans son cabinet, dans l'ordre où on le relit, et qu'une
 * modification ne puisse pas déplacer une ligne d'un dossier vers un autre.
 */
function contextFor(cabinetId: string, userId: string, role: "owner" | "accountant" | "assistant" = "owner"): AuthContext {
  const scope = { cabinetId, clientIds: null };
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

describe("liste d'activité", () => {
  let ctx: AuthContext;
  let autre: AuthContext;
  let clientId: string;

  beforeAll(async () => {
    const [cabinet, cabinetB, user] = await Promise.all([
      makeCabinet("Activités"),
      makeCabinet("Activités bis"),
      makeUser(),
    ]);
    const client = await makeClient(cabinet.id);
    clientId = client.id;
    ctx = contextFor(cabinet.id, user.id);
    autre = contextFor(cabinetB.id, user.id);
  });

  it("enregistre un service avec son motif et son compte rendu", async () => {
    const created = await createIntervention(ctx, {
      clientId,
      service: "Dépôt de la TVA du trimestre",
      performedAt: "2026-04-18",
      reason: "Échéance trimestrielle",
      report: "Télédéclaration déposée, accusé archivé.",
    });

    expect(created.service).toBe("Dépôt de la TVA du trimestre");
    expect(created.reason).toBe("Échéance trimestrielle");
    expect(created.report).toBe("Télédéclaration déposée, accusé archivé.");
  });

  it("refuse un service sans nom", async () => {
    await expect(
      createIntervention(ctx, { clientId, service: "", performedAt: "2026-04-18" }),
    ).rejects.toThrow();
  });

  it("rend la liste du plus récent au plus ancien", async () => {
    await createIntervention(ctx, {
      clientId,
      service: "Rendez-vous au cabinet",
      performedAt: "2026-01-05",
    });
    await createIntervention(ctx, {
      clientId,
      service: "Passage à la DGI",
      performedAt: "2026-06-30",
    });

    const rows = await listInterventions(ctx, clientId);
    const dates = rows.map((row) => row.performedAt.getTime());
    expect([...dates].sort((a, b) => b - a)).toEqual(dates);
    expect(rows[0]?.service).toBe("Passage à la DGI");
  });

  it("ne déplace pas une ligne vers un autre dossier", async () => {
    const other = await makeClient(ctx.cabinet.id);
    const created = await createIntervention(ctx, {
      clientId,
      service: "Régularisation CNSS",
      performedAt: "2026-02-02",
    });

    // Le dossier envoyé est ignoré : il est relu depuis la ligne existante.
    const updated = await updateIntervention(ctx, created.id, {
      clientId: other.id,
      service: "Régularisation CNSS",
      performedAt: "2026-02-03",
    });

    expect(updated.clientId).toBe(clientId);
  });

  it("reste invisible depuis un autre cabinet", async () => {
    const rows = await listInterventions(ctx, clientId);
    const target = rows[0];
    if (!target) throw new Error("aucune ligne à vérifier");

    await expect(deleteIntervention(autre, target.id)).rejects.toThrow();
  });

  it("retire une ligne", async () => {
    const created = await createIntervention(ctx, {
      clientId,
      service: "À retirer",
      performedAt: "2026-03-03",
    });

    await deleteIntervention(ctx, created.id);
    const rows = await listInterventions(ctx, clientId);
    expect(rows.some((row) => row.id === created.id)).toBe(false);
  });
});
