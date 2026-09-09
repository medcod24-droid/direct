import { beforeAll, describe, expect, it } from "vitest";
import type { AuthContext } from "@/lib/authz/guard";
import { can } from "@/lib/authz/permissions";
import { tenantDb } from "@/lib/db/tenant";
import type { Role } from "@/lib/domain/enums";
import { listMemberActivity } from "@/server/services/members";
import {
  approveTodo,
  createTodo,
  listMyTodos,
  listTodos,
  returnTodo,
  submitTodo,
  todoCounts,
} from "@/server/services/todos";
import { makeCabinet, makeClient, makeMembership, makeUser } from "../factories";

/**
 * Liste de tâches de l'équipe.
 *
 * Le va-et-vient est le sujet : l'administrateur confie, le collaborateur rend
 * avec une note, l'administrateur confirme. Ce qui doit tenir, c'est que
 * personne ne saute une étape et que chacun ne voie que ce qui le regarde.
 */
function contextFor(cabinetId: string, userId: string, role: Role): AuthContext {
  const scope = { cabinetId, clientIds: null };
  return {
    sessionId: "test",
    user: { id: userId, email: `${userId}@directconseil.ma`, name: "Test", locale: "fr" },
    cabinet: { id: cabinetId, name: "Cabinet", slug: "c", cndpMode: "declaration" },
    membership: { id: "m", role, restrictedToAssigned: false, clientId: null },
    scope,
    db: tenantDb(scope),
    ip: null,
    userAgent: "vitest",
    can: (p) => can(role, p),
  };
}

describe("to-do de l'équipe", () => {
  let admin: AuthContext;
  let assistant: AuthContext;
  let autre: AuthContext;
  let assistantId: string;
  let clientId: string;

  beforeAll(async () => {
    const [cabinet, cabinetB] = await Promise.all([makeCabinet("To-do"), makeCabinet("To-do bis")]);
    const [owner, worker] = await Promise.all([makeUser(), makeUser()]);
    assistantId = worker.id;

    await Promise.all([
      makeMembership({ userId: owner.id, cabinetId: cabinet.id, role: "owner" }),
      makeMembership({ userId: worker.id, cabinetId: cabinet.id, role: "assistant" }),
    ]);

    const client = await makeClient(cabinet.id);
    clientId = client.id;

    admin = contextFor(cabinet.id, owner.id, "owner");
    assistant = contextFor(cabinet.id, worker.id, "assistant");
    autre = contextFor(cabinetB.id, owner.id, "owner");
  });

  it("confie une tâche à un collaborateur", async () => {
    const created = await createTodo(admin, {
      assigneeId: assistantId,
      title: "Déposer les déclarations à la DGI",
      dueDate: "2026-10-05",
      priority: "high",
      clientId,
    });

    expect(created.status).toBe("assigned");
    expect(created.assigneeId).toBe(assistantId);
    expect(created.clientId).toBe(clientId);
  });

  it("montre la tâche au collaborateur, sur sa liste et son tableau de bord", async () => {
    const sienne = await listTodos(assistant);
    expect(sienne.some((todo) => todo.title === "Déposer les déclarations à la DGI")).toBe(true);

    const dashboard = await listMyTodos(assistant);
    expect(dashboard.some((todo) => todo.title === "Déposer les déclarations à la DGI")).toBe(true);
  });

  it("ne montre à un collaborateur que ce qui lui est confié", async () => {
    const autreUser = await makeUser();
    await makeMembership({ userId: autreUser.id, cabinetId: admin.cabinet.id, role: "assistant" });
    await createTodo(admin, { assigneeId: autreUser.id, title: "Tâche d'un autre" });

    const sienne = await listTodos(assistant);
    expect(sienne.some((todo) => todo.title === "Tâche d'un autre")).toBe(false);

    // L'administrateur, lui, voit les deux.
    const toutes = await listTodos(admin);
    expect(toutes.some((todo) => todo.title === "Tâche d'un autre")).toBe(true);
  });

  it("exige une note pour rendre une tâche", async () => {
    const created = await createTodo(admin, { assigneeId: assistantId, title: "Sans note" });
    await expect(submitTodo(assistant, created.id, { note: "" })).rejects.toThrow();
  });

  it("refuse qu'un collaborateur rende la tâche d'un autre", async () => {
    const created = await createTodo(admin, { assigneeId: admin.user.id, title: "Tâche de l'admin" });
    await expect(
      submitTodo(assistant, created.id, { note: "Fait." }),
    ).rejects.toThrow(/autre collaborateur/);
  });

  it("passe en attente à la remise, puis au vert à la confirmation", async () => {
    const created = await createTodo(admin, { assigneeId: assistantId, title: "Classement" });

    const rendue = await submitTodo(assistant, created.id, { note: "Fait, tout est classé." });
    expect(rendue.status).toBe("submitted");
    expect(rendue.submittedNote).toBe("Fait, tout est classé.");
    expect(rendue.submittedAt).not.toBeNull();

    const confirmee = await approveTodo(admin, created.id);
    expect(confirmee.status).toBe("approved");
    expect(confirmee.approvedById).toBe(admin.user.id);
  });

  it("ne confirme pas une tâche qui n'a pas été rendue", async () => {
    const created = await createTodo(admin, { assigneeId: assistantId, title: "Pas encore rendue" });
    await expect(approveTodo(admin, created.id)).rejects.toThrow(/rendue/);
  });

  it("renvoie une tâche incomplète, avec son motif", async () => {
    const created = await createTodo(admin, { assigneeId: assistantId, title: "Incomplète" });
    await submitTodo(assistant, created.id, { note: "Il manque une pièce." });

    await expect(returnTodo(admin, created.id, { note: "" })).rejects.toThrow();

    const renvoyee = await returnTodo(admin, created.id, { note: "Demande la pièce au client." });
    expect(renvoyee.status).toBe("returned");
    expect(renvoyee.reviewNote).toBe("Demande la pièce au client.");

    // Renvoyée, elle revient sur le tableau de bord du collaborateur.
    const dashboard = await listMyTodos(assistant);
    expect(dashboard.some((todo) => todo.id === created.id)).toBe(true);

    // Et le motif du renvoi disparaît dès qu'elle est rendue de nouveau.
    const rendue = await submitTodo(assistant, created.id, { note: "Pièce obtenue." });
    expect(rendue.reviewNote).toBeNull();
  });

  it("refuse une tâche confiée hors du cabinet", async () => {
    const etranger = await makeUser();
    await expect(
      createTodo(admin, { assigneeId: etranger.id, title: "Hors cabinet" }),
    ).rejects.toThrow(/hors du cabinet/);
  });

  it("reste invisible depuis un autre cabinet", async () => {
    expect(await listTodos(autre)).toHaveLength(0);
  });

  it("compte les tâches par état", async () => {
    const counts = await todoCounts(admin, assistantId);
    expect(counts.approved).toBeGreaterThan(0);
    expect(counts.assigned + counts.submitted + counts.returned).toBeGreaterThan(0);
  });

  it("retrace ce qu'un collaborateur a fait", async () => {
    const activity = await listMemberActivity(admin, assistantId);
    expect(activity.some((entry) => entry.action === "todo.submitted")).toBe(true);
    expect(activity[0]?.label).toBeTruthy();
    // L'historique est rendu du plus récent au plus ancien.
    const dates = activity.map((entry) => entry.createdAt.getTime());
    expect([...dates].sort((a, b) => b - a)).toEqual(dates);
  });
});
