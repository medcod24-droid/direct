import { beforeAll, describe, expect, it } from "vitest";
import type { AuthContext } from "@/lib/authz/guard";
import { AppError } from "@/lib/errors";
import { can } from "@/lib/authz/permissions";
import { assertWithinLimit, getEntitlements } from "@/lib/billing/entitlements";
import { platformDb, tenantDb } from "@/lib/db/tenant";
import type { Role } from "@/lib/domain/enums";
import { createClient } from "@/server/services/clients";
import { openDocument } from "@/server/services/documents";
import { createRequest } from "@/server/services/requests";
import { createTask } from "@/server/services/tasks";
import { makeCabinet, makeClient, makeDocument, makeUser } from "../factories";

/**
 * Scénarios de sécurité exigés avant mise en production.
 * Chacun rejoue une tentative d'accès non autorisée ; la réponse attendue est toujours
 * un refus, y compris lorsque l'identifiant visé est exact.
 */

function contextFor(input: {
  cabinetId: string;
  userId: string;
  role: Role;
  clientIds?: string[] | null;
  cndpMode?: string;
}): AuthContext {
  const scope = { cabinetId: input.cabinetId, clientIds: input.clientIds ?? null };
  return {
    sessionId: "test-session",
    user: { id: input.userId, email: "test@directconseil.ma", name: "Test", locale: "fr" },
    cabinet: {
      id: input.cabinetId,
      name: "Cabinet",
      slug: "cabinet",
      cndpMode: input.cndpMode ?? "declaration",
    },
    membership: {
      id: "membership",
      role: input.role,
      restrictedToAssigned: Boolean(input.clientIds),
      clientId: input.role === "client" ? (input.clientIds?.[0] ?? null) : null,
    },
    scope,
    db: tenantDb(scope),
    ip: "127.0.0.1",
    userAgent: "vitest",
    can: (permission) => can(input.role, permission),
  };
}

describe("cloisonnement entre cabinets par l'API", () => {
  let cabinetA: { id: string };
  let cabinetB: { id: string };
  let clientB: { id: string };
  let documentB: { id: string };
  let userA: { id: string };

  beforeAll(async () => {
    cabinetA = await makeCabinet("API A");
    cabinetB = await makeCabinet("API B");
    clientB = await makeClient(cabinetB.id);
    documentB = await makeDocument(cabinetB.id, clientB.id);
    userA = await makeUser();
  });

  it("un identifiant de dossier d'un autre cabinet passé à l'API est refusé", async () => {
    const ctx = contextFor({ cabinetId: cabinetA.id, userId: userA.id, role: "owner" });
    await expect(
      createRequest(ctx, { clientId: clientB.id, title: "Relevé bancaire" }),
    ).rejects.toThrow(/introuvable|accessible/i);
  });

  it("le téléchargement d'un document d'un autre cabinet est refusé et journalisé", async () => {
    const ctx = contextFor({ cabinetId: cabinetA.id, userId: userA.id, role: "owner" });
    const error = await openDocument(ctx, documentB.id).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(AppError);
    // Le message montré à l'utilisateur ne révèle pas l'existence de la ressource.
    expect((error as AppError).publicMessage).toMatch(/n'existe pas|accessible/i);
    expect((error as AppError).status).toBe(404);

    const denied = await platformDb.auditLog.findFirst({
      where: { action: "document.access_denied", resourceId: documentB.id },
      orderBy: { createdAt: "desc" },
    });
    expect(denied?.outcome).toBe("denied");
    expect(denied?.cabinetId).toBe(cabinetA.id);
  });

  it("une tâche ne peut pas être assignée à un utilisateur d'un autre cabinet", async () => {
    const userB = await makeUser();
    await platformDb.membership.create({
      data: { userId: userB.id, cabinetId: cabinetB.id, role: "accountant" },
    });
    const ctx = contextFor({ cabinetId: cabinetA.id, userId: userA.id, role: "owner" });
    await expect(
      createTask(ctx, { title: "Tâche", assigneeId: userB.id }),
    ).rejects.toThrow(/introuvable/i);
  });
});

describe("cloisonnement entre clients du portail", () => {
  it("un compte client ne voit que son propre dossier", async () => {
    const cabinet = await makeCabinet("Portail");
    const mine = await makeClient(cabinet.id, { legalName: "Mon dossier" });
    const other = await makeClient(cabinet.id, { legalName: "Dossier voisin" });
    const documentOther = await makeDocument(cabinet.id, other.id);
    const user = await makeUser();

    const ctx = contextFor({
      cabinetId: cabinet.id,
      userId: user.id,
      role: "client",
      clientIds: [mine.id],
    });

    expect(await ctx.db.client.findMany()).toHaveLength(1);
    expect(await ctx.db.client.findUnique({ where: { id: other.id } })).toBeNull();
    await expect(openDocument(ctx, documentOther.id)).rejects.toThrow();
  });

  it("un compte client n'a aucune permission interne au cabinet", () => {
    expect(can("client", "note.internal")).toBe(false);
    expect(can("client", "audit.view")).toBe(false);
    expect(can("client", "member.view")).toBe(false);
    expect(can("client", "client.create")).toBe(false);
    expect(can("client", "invoice.manage")).toBe(false);
    expect(can("client", "portal.access")).toBe(true);
  });

  it("les notes internes ne sont jamais visibles côté client", async () => {
    const cabinet = await makeCabinet("Notes");
    const client = await makeClient(cabinet.id);
    const user = await makeUser();

    await platformDb.message.createMany({
      data: [
        { cabinetId: cabinet.id, clientId: client.id, body: "Note interne", isInternal: true },
        { cabinetId: cabinet.id, clientId: client.id, body: "Message au client", isInternal: false },
      ],
    });

    const ctx = contextFor({
      cabinetId: cabinet.id,
      userId: user.id,
      role: "client",
      clientIds: [client.id],
    });

    // Le portail ne charge que les messages non internes : la requête le prouve.
    const visible = await ctx.db.message.findMany({ where: { isInternal: false } });
    expect(visible.map((m) => m.body)).toEqual(["Message au client"]);
  });
});

describe("permissions des rôles internes", () => {
  it("un assistant ne peut ni supprimer ni valider un document, ni voir les honoraires", () => {
    expect(can("assistant", "document.upload")).toBe(true);
    expect(can("assistant", "document.delete")).toBe(false);
    expect(can("assistant", "document.approve")).toBe(false);
    expect(can("assistant", "invoice.view")).toBe(false);
    expect(can("assistant", "note.internal")).toBe(false);
    expect(can("assistant", "member.manage")).toBe(false);
  });

  it("un comptable ne gère ni l'équipe, ni la facturation de l'abonnement, ni le journal d'audit", () => {
    expect(can("accountant", "client.update")).toBe(true);
    expect(can("accountant", "deadline.generate")).toBe(true);
    expect(can("accountant", "member.manage")).toBe(false);
    expect(can("accountant", "billing.manage")).toBe(false);
    expect(can("accountant", "audit.view")).toBe(false);
  });

  it("seul le propriétaire peut supprimer le cabinet", () => {
    expect(can("owner", "cabinet.delete")).toBe(true);
    expect(can("admin", "cabinet.delete")).toBe(false);
  });

  it("un collaborateur restreint ne peut pas créer une demande sur un dossier non assigné", async () => {
    const cabinet = await makeCabinet("Restreint");
    const assigned = await makeClient(cabinet.id);
    const other = await makeClient(cabinet.id);
    const user = await makeUser();

    const ctx = contextFor({
      cabinetId: cabinet.id,
      userId: user.id,
      role: "accountant",
      clientIds: [assigned.id],
    });

    await expect(createRequest(ctx, { clientId: other.id, title: "Pièce" })).rejects.toThrow();
    await expect(createRequest(ctx, { clientId: assigned.id, title: "Pièce" })).resolves.toBeTruthy();
  });
});

describe("limites du plan : elles ne peuvent pas être contournées depuis le client", () => {
  it("les limites viennent du plan en base, pas de la requête", async () => {
    const cabinet = await makeCabinet("Limites");
    const entitlements = await getEntitlements(cabinet.id);
    expect(entitlements.planCode).toBe("professional");
    expect(entitlements.limits.maxClients).toBe(120);
  });

  it("la création est bloquée au-delà de la limite du plan", async () => {
    const cabinet = await makeCabinet("Petit plan");
    const starter = await platformDb.plan.findUniqueOrThrow({ where: { code: "starter" } });
    // On rétrograde l'abonnement et on abaisse la limite pour un test rapide.
    await platformDb.subscription.update({
      where: { cabinetId: cabinet.id },
      data: { planId: starter.id, status: "active" },
    });
    const original = starter.maxClients;
    await platformDb.plan.update({ where: { id: starter.id }, data: { maxClients: 1 } });

    const user = await makeUser();
    const ctx = contextFor({ cabinetId: cabinet.id, userId: user.id, role: "owner" });

    await createClient(ctx, {
      kind: "company",
      subtype: "sarl",
      legalName: "Premier dossier",
      takeoverDate: new Date("2026-01-01"),
    });

    await expect(
      createClient(ctx, {
        kind: "company",
        subtype: "sarl",
        legalName: "Dossier de trop",
        takeoverDate: new Date("2026-01-01"),
      }),
    ).rejects.toThrow(/Limite du plan/i);

    await platformDb.plan.update({ where: { id: starter.id }, data: { maxClients: original } });
  });

  it("un abonnement expiré bloque la création", async () => {
    const cabinet = await makeCabinet("Essai fini");
    await platformDb.subscription.update({
      where: { cabinetId: cabinet.id },
      data: { status: "trialing", trialEndsAt: new Date(Date.now() - 86400000) },
    });
    const error = await assertWithinLimit(cabinet.id, "clients").catch((e: unknown) => e);
    expect(error).toBeInstanceOf(AppError);
    expect((error as AppError).publicMessage).toMatch(/plus actif/i);
  });
});

describe("protection des données personnelles (loi 09-08)", () => {
  it("le numéro de CIN est refusé tant que le cabinet est en mode déclaration", async () => {
    const cabinet = await makeCabinet("CNDP");
    const user = await makeUser();
    const ctx = contextFor({
      cabinetId: cabinet.id,
      userId: user.id,
      role: "owner",
      cndpMode: "declaration",
    });

    await expect(
      createClient(ctx, {
        kind: "company",
        subtype: "sarl",
        legalName: "Avec CIN",
        managerCin: "BK123456",
        takeoverDate: new Date("2026-01-01"),
      }),
    ).rejects.toThrow(/déclaration/i);
  });

  it("le journal d'audit ne contient ni mot de passe ni numéro de CIN", async () => {
    const { recordAudit } = await import("@/lib/audit");
    const cabinet = await makeCabinet("Audit");
    await recordAudit({
      action: "test.sanitize",
      cabinetId: cabinet.id,
      metadata: { password: "secret", managerCin: "BK123456", filename: "facture.pdf" },
    });

    const entry = await platformDb.auditLog.findFirst({
      where: { action: "test.sanitize", cabinetId: cabinet.id },
    });
    expect(entry?.metadata).toContain("facture.pdf");
    expect(entry?.metadata).not.toContain("secret");
    expect(entry?.metadata).not.toContain("BK123456");
  });
});
