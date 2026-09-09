import { beforeAll, describe, expect, it } from "vitest";
import type { AuthContext } from "@/lib/authz/guard";
import { can } from "@/lib/authz/permissions";
import { wallTime } from "@/lib/calendar/month";
import { tenantDb } from "@/lib/db/tenant";
import {
  completeAppointment,
  createAppointment,
  deleteAppointment,
  listAppointments,
  listAwaitingReview,
  setAppointmentStatus,
} from "@/server/services/appointments";
import { listInterventions } from "@/server/services/interventions";
import { makeCabinet, makeClient, makeUser } from "../factories";

/**
 * Rendez-vous.
 *
 * Deux choses comptent ici : l'heure saisie est l'heure enregistrée, quel que
 * soit le fuseau du runtime ; et valider un rendez-vous verse son compte rendu
 * dans la liste d'activité du client, là où le comptable le relira.
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

describe("rendez-vous", () => {
  let ctx: AuthContext;
  let autre: AuthContext;
  let clientId: string;

  beforeAll(async () => {
    const [cabinet, cabinetB, user] = await Promise.all([
      makeCabinet("Rendez-vous"),
      makeCabinet("Rendez-vous bis"),
      makeUser(),
    ]);
    const client = await makeClient(cabinet.id);
    clientId = client.id;
    ctx = contextFor(cabinet.id, user.id);
    autre = contextFor(cabinetB.id, user.id);
  });

  it("enregistre l'heure telle qu'elle a été saisie", async () => {
    const created = await createAppointment(ctx, {
      clientId,
      title: "Remise des pièces du trimestre",
      startsAt: "2026-10-14T09:30",
      durationMinutes: 45,
      mode: "office",
    });

    // Aucune conversion de fuseau : 9 h 30 saisi, 9 h 30 relu.
    expect(wallTime(created.startsAt)).toBe("09:30");
    expect(created.durationMinutes).toBe(45);
    expect(created.status).toBe("scheduled");
  });

  it("refuse une date inexploitable", async () => {
    await expect(
      createAppointment(ctx, { clientId, title: "Sans date", startsAt: "demain" }),
    ).rejects.toThrow();
  });

  it("refuse un rendez-vous sans client", async () => {
    await expect(
      createAppointment(ctx, { title: "Orphelin", startsAt: "2026-10-14T09:00" }),
    ).rejects.toThrow();
  });

  it("verse le compte rendu dans la liste d'activité à la validation", async () => {
    const created = await createAppointment(ctx, {
      clientId,
      title: "Point sur la clôture",
      startsAt: "2026-05-20T11:00",
    });

    const done = await completeAppointment(ctx, created.id, {
      outcome: "Bilan revu ensemble ; il manque les relevés de décembre.",
      reason: "Clôture 2025",
    });

    expect(done.status).toBe("done");
    expect(done.interventionId).toBeTruthy();

    const rows = await listInterventions(ctx, clientId);
    const line = rows.find((row) => row.id === done.interventionId);
    expect(line?.service).toBe("Point sur la clôture");
    expect(line?.reason).toBe("Clôture 2025");
    expect(line?.report).toBe("Bilan revu ensemble ; il manque les relevés de décembre.");
    // La date de la ligne est celle du rendez-vous, pas celle de la saisie.
    expect(wallTime(line?.performedAt as Date)).toBe("11:00");
  });

  it("refuse une validation sans compte rendu", async () => {
    const created = await createAppointment(ctx, {
      clientId,
      title: "Sans compte rendu",
      startsAt: "2026-05-21T11:00",
    });

    await expect(completeAppointment(ctx, created.id, { outcome: "" })).rejects.toThrow();
  });

  it("ne valide pas deux fois le même rendez-vous", async () => {
    const created = await createAppointment(ctx, {
      clientId,
      title: "Validé une fois",
      startsAt: "2026-05-22T11:00",
    });
    await completeAppointment(ctx, created.id, { outcome: "Fait." });

    await expect(
      completeAppointment(ctx, created.id, { outcome: "Refait." }),
    ).rejects.toThrow(/déjà été validé/);
  });

  it("protège un rendez-vous validé de la suppression et du changement d'état", async () => {
    const created = await createAppointment(ctx, {
      clientId,
      title: "Intouchable",
      startsAt: "2026-05-23T11:00",
    });
    await completeAppointment(ctx, created.id, { outcome: "Fait." });

    await expect(deleteAppointment(ctx, created.id)).rejects.toThrow();
    await expect(setAppointmentStatus(ctx, created.id, "cancelled")).rejects.toThrow();
  });

  it("signale un rendez-vous passé resté prévu", async () => {
    const past = await createAppointment(ctx, {
      clientId,
      title: "Passé sans validation",
      startsAt: "2026-01-09T08:00",
    });

    const awaiting = await listAwaitingReview(ctx, new Date("2026-02-01T00:00:00Z"));
    expect(awaiting.some((row) => row.id === past.id)).toBe(true);

    // Une fois validé, il sort de la liste.
    await completeAppointment(ctx, past.id, { outcome: "Compte rendu tardif." });
    const after = await listAwaitingReview(ctx, new Date("2026-02-01T00:00:00Z"));
    expect(after.some((row) => row.id === past.id)).toBe(false);
  });

  it("filtre sur une plage de dates", async () => {
    const rows = await listAppointments(ctx, {
      from: new Date("2026-10-01T00:00:00Z"),
      to: new Date("2026-11-01T00:00:00Z"),
    });
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((row) => row.startsAt >= new Date("2026-10-01T00:00:00Z"))).toBe(true);
    expect(rows.every((row) => row.startsAt < new Date("2026-11-01T00:00:00Z"))).toBe(true);
  });

  it("reste invisible depuis un autre cabinet", async () => {
    const rows = await listAppointments(ctx, {});
    const target = rows[0];
    if (!target) throw new Error("aucun rendez-vous à vérifier");

    expect(await listAppointments(autre, {})).toHaveLength(0);
    await expect(deleteAppointment(autre, target.id)).rejects.toThrow();
  });
});
