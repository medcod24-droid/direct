import { beforeAll, describe, expect, it } from "vitest";
import type { AuthContext } from "@/lib/authz/guard";
import { can } from "@/lib/authz/permissions";
import { platformDb, tenantDb } from "@/lib/db/tenant";
import { listDeadlines, setManagedBy } from "@/server/services/deadlines";
import { makeCabinet, makeClient, makeUser } from "../factories";

const NOW = new Date("2026-09-03T00:00:00Z");

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

/**
 * Le retard d'une échéance se déduit de sa date, il n'est pas stocké.
 * Filtrer sur un statut « overdue » ne renvoyait donc jamais rien.
 */
describe("filtres des échéances", () => {
  let ctx: AuthContext;
  let clientId: string;

  beforeAll(async () => {
    const cabinet = await makeCabinet("Filtres");
    const user = await makeUser();
    const client = await makeClient(cabinet.id);
    clientId = client.id;
    ctx = contextFor(cabinet.id, user.id);

    await platformDb.deadline.createMany({
      data: [
        { cabinetId: cabinet.id, clientId, label: "Dépassée", periodLabel: "P1",
          dueDate: new Date("2026-02-10"), managedBy: "cabinet", status: "upcoming" },
        { cabinetId: cabinet.id, clientId, label: "Dépassée déclarée", periodLabel: "P2",
          dueDate: new Date("2026-03-10"), managedBy: "cabinet", status: "declared" },
        { cabinetId: cabinet.id, clientId, label: "À venir", periodLabel: "P3",
          dueDate: new Date("2026-12-10"), managedBy: "cabinet", status: "upcoming" },
        { cabinetId: cabinet.id, clientId, label: "Réglée", periodLabel: "P4",
          dueDate: new Date("2026-01-10"), managedBy: "cabinet", status: "paid" },
      ],
    });
  });

  it("« en retard » renvoie les échéances échues et non soldées", async () => {
    const rows = await listDeadlines(ctx, { status: "overdue", now: NOW });
    expect(rows.map((r) => r.label).sort()).toEqual(["Dépassée", "Dépassée déclarée"]);
  });

  it("« en retard » exclut ce qui est à venir ou déjà réglé", async () => {
    const rows = await listDeadlines(ctx, { status: "overdue", now: NOW });
    expect(rows.some((r) => r.label === "À venir")).toBe(false);
    expect(rows.some((r) => r.label === "Réglée")).toBe(false);
  });

  it("« ouvertes » garde les échéances futures", async () => {
    const rows = await listDeadlines(ctx, { status: "open", now: NOW });
    expect(rows.some((r) => r.label === "À venir")).toBe(true);
  });

  it("« payées » ne renvoie que les soldées", async () => {
    const rows = await listDeadlines(ctx, { status: "paid", now: NOW });
    expect(rows.map((r) => r.label)).toEqual(["Réglée"]);
  });

  it("« toutes » renvoie l'ensemble", async () => {
    const rows = await listDeadlines(ctx, { status: "all", now: NOW });
    expect(rows).toHaveLength(4);
  });

  it("une échéance confiée au client reste listée mais change de responsable", async () => {
    const rows = await listDeadlines(ctx, { status: "overdue", now: NOW });
    const cible = rows[0]!;
    await setManagedBy(ctx, { deadlineId: cible.id, managedBy: "client" });

    const apres = await listDeadlines(ctx, { status: "overdue", now: NOW });
    expect(apres.find((r) => r.id === cible.id)?.managedBy).toBe("client");
  });
});
