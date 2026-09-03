import { beforeAll, describe, expect, it } from "vitest";
import type { AuthContext } from "@/lib/authz/guard";
import { can } from "@/lib/authz/permissions";
import { tenantDb } from "@/lib/db/tenant";
import type { Role } from "@/lib/domain/enums";
import { platformDb } from "@/lib/db/tenant";
import { updateDeadlineStatus } from "@/server/services/deadlines";
import { makeCabinet, makeClient, makeDocument, makeUser } from "../factories";

function contextFor(cabinetId: string, userId: string, role: Role = "owner"): AuthContext {
  const scope = { cabinetId, clientIds: null };
  return {
    sessionId: "test-session",
    user: { id: userId, email: "test@directconseil.ma", name: "Test", locale: "fr" },
    cabinet: { id: cabinetId, name: "Cabinet", slug: "cabinet", cndpMode: "declaration" },
    membership: { id: "membership", role, restrictedToAssigned: false, clientId: null },
    scope,
    db: tenantDb(scope),
    ip: "127.0.0.1",
    userAgent: "vitest",
    can: (permission) => can(role, permission),
  };
}

/**
 * Règle métier : une échéance ne passe au vert qu'avec sa preuve de dépôt.
 * C'est la pièce que le cabinet produira en cas de contrôle.
 */
describe("preuve de dépôt obligatoire", () => {
  let ctx: AuthContext;
  let clientId: string;
  let cabinetId: string;

  // `(clientId, periodLabel)` est unique — c'est ce qui rend la génération idempotente.
  // Chaque échéance de test porte donc sa propre période.
  let seq = 0;

  async function newDeadline() {
    seq += 1;
    const deadline = await platformDb.deadline.create({
      data: {
        cabinetId,
        clientId,
        label: "Déclaration et paiement CNSS",
        periodLabel: `CNSS période ${seq} 2026`,
        dueDate: new Date("2026-02-10"),
        managedBy: "cabinet",
        status: "upcoming",
      },
    });
    return deadline.id;
  }

  beforeAll(async () => {
    const cabinet = await makeCabinet("Preuve");
    cabinetId = cabinet.id;
    const user = await makeUser();
    const client = await makeClient(cabinet.id);
    clientId = client.id;
    ctx = contextFor(cabinet.id, user.id);
  });

  it("refuse le passage à « payée » sans preuve", async () => {
    const deadlineId = await newDeadline();
    await expect(
      updateDeadlineStatus(ctx, { deadlineId, action: "pay" }),
    ).rejects.toThrow(/preuve de dépôt/i);

    const after = await platformDb.deadline.findUniqueOrThrow({ where: { id: deadlineId } });
    expect(after.status).toBe("upcoming");
    expect(after.paidAt).toBeNull();
  });

  it("accepte le passage à « payée » avec une preuve du même dossier", async () => {
    const deadlineId = await newDeadline();
    const proof = await makeDocument(cabinetId, clientId);

    const updated = await updateDeadlineStatus(ctx, {
      deadlineId,
      action: "pay",
      proofDocumentId: proof.id,
    });
    expect(updated.status).toBe("paid");
    expect(updated.proofDocumentId).toBe(proof.id);
  });

  it("accepte « payée » si la preuve a déjà été jointe à la déclaration", async () => {
    const deadlineId = await newDeadline();
    const proof = await makeDocument(cabinetId, clientId);

    await updateDeadlineStatus(ctx, {
      deadlineId,
      action: "declare",
      proofDocumentId: proof.id,
    });
    const updated = await updateDeadlineStatus(ctx, { deadlineId, action: "pay" });
    expect(updated.status).toBe("paid");
  });

  it("refuse une preuve appartenant à un autre dossier", async () => {
    const deadlineId = await newDeadline();
    const other = await makeClient(cabinetId);
    const foreignProof = await makeDocument(cabinetId, other.id);

    await expect(
      updateDeadlineStatus(ctx, { deadlineId, action: "pay", proofDocumentId: foreignProof.id }),
    ).rejects.toThrow(/même dossier/i);
  });

  it("laisse « déclarée » possible sans preuve : seul le vert l'exige", async () => {
    const deadlineId = await newDeadline();
    const updated = await updateDeadlineStatus(ctx, { deadlineId, action: "declare" });
    expect(updated.status).toBe("declared");
  });
});
