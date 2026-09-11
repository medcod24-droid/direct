import { beforeAll, describe, expect, it } from "vitest";
import type { AuthContext } from "@/lib/authz/guard";
import { can } from "@/lib/authz/permissions";
import { tenantDb } from "@/lib/db/tenant";
import { createIntervention, listInterventionsBetween } from "@/server/services/interventions";
import { makeCabinet, makeClient, makeUser } from "../factories";

/**
 * Liste d'activité du jour, sur le tableau de bord.
 *
 * Elle rassemble ce que le cabinet a fait aujourd'hui pour tous ses clients.
 * Ce qui doit tenir : la journée est bornée, un collaborateur restreint ne voit
 * que ses dossiers, et rien ne vient d'un autre cabinet.
 */
function contextFor(cabinetId: string, userId: string, clientIds: string[] | null = null): AuthContext {
  const scope = { cabinetId, clientIds };
  return {
    sessionId: "test",
    user: { id: userId, email: "t@directconseil.ma", name: "Test", locale: "fr" },
    cabinet: { id: cabinetId, name: "Cabinet", slug: "c", cndpMode: "declaration" },
    membership: { id: "m", role: "owner", restrictedToAssigned: clientIds !== null, clientId: null },
    scope,
    db: tenantDb(scope),
    ip: null,
    userAgent: "vitest",
    can: (p) => can("owner", p),
  };
}

const DAY_START = new Date("2026-05-12T00:00:00Z");
const DAY_END = new Date("2026-05-13T00:00:00Z");

describe("liste d'activité du jour", () => {
  let ctx: AuthContext;
  let ctxB: AuthContext;
  let userId: string;
  let cabinetId: string;
  let clientA: string;
  let clientB: string;

  beforeAll(async () => {
    const [cabinet, cabinetB, user] = await Promise.all([
      makeCabinet("Journée"),
      makeCabinet("Journée bis"),
      makeUser(),
    ]);
    userId = user.id;
    cabinetId = cabinet.id;
    const [a, b, c] = await Promise.all([
      makeClient(cabinet.id),
      makeClient(cabinet.id),
      makeClient(cabinetB.id),
    ]);
    clientA = a.id;
    clientB = b.id;
    ctx = contextFor(cabinet.id, user.id);
    ctxB = contextFor(cabinetB.id, user.id);

    await createIntervention(ctx, { clientId: clientA, service: "Dépôt TVA", performedAt: "2026-05-12" });
    await createIntervention(ctx, { clientId: clientB, service: "Passage à la CNSS", performedAt: "2026-05-12" });
    await createIntervention(ctx, { clientId: clientA, service: "Bilan remis", performedAt: "2026-05-12" });
    await createIntervention(ctx, { clientId: clientA, service: "Veille", performedAt: "2026-05-11" });
    await createIntervention(ctxB, { clientId: c.id, service: "Autre cabinet", performedAt: "2026-05-12" });
  });

  it("rassemble les services du jour, tous dossiers confondus, dans l'ordre de saisie", async () => {
    const rows = await listInterventionsBetween(ctx, DAY_START, DAY_END);
    expect(rows.map((row) => row.service)).toEqual(["Dépôt TVA", "Passage à la CNSS", "Bilan remis"]);
    expect(new Set(rows.map((row) => row.client.id))).toEqual(new Set([clientA, clientB]));
    expect(rows[0]?.client.legalName).toBeTruthy();
  });

  it("ne montre à un collaborateur restreint que ses dossiers", async () => {
    const restricted = contextFor(cabinetId, userId, [clientB]);
    const rows = await listInterventionsBetween(restricted, DAY_START, DAY_END);
    expect(rows.map((row) => row.service)).toEqual(["Passage à la CNSS"]);
  });

  it("ne mêle pas les cabinets", async () => {
    const rows = await listInterventionsBetween(ctxB, DAY_START, DAY_END);
    expect(rows.map((row) => row.service)).toEqual(["Autre cabinet"]);
  });
});
