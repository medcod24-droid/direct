import { recordAudit } from "@/lib/audit";
import type { AuthContext } from "@/lib/authz/guard";
import { requireClient } from "@/lib/authz/guard";
import { NotFoundError, ValidationError } from "@/lib/errors";
import { notify } from "@/lib/notifications/service";
import { documentRequestSchema, reviewSchema } from "@/lib/validation/schemas";
import { uploadDocument, type UploadFile } from "@/server/services/documents";

/**
 * Demandes de pièces : le flux le plus utilisé du produit.
 * Le cabinet demande une pièce, le client la dépose, le cabinet valide ou refuse
 * en expliquant pourquoi. Chaque étape est datée et tracée.
 */

export async function createRequest(ctx: AuthContext, input: unknown) {
  const data = documentRequestSchema.parse(input);
  await requireClient(ctx, data.clientId);

  const request = await ctx.db.documentRequest.create({
    data: {
      cabinetId: ctx.cabinet.id,
      clientId: data.clientId,
      title: data.title,
      description: data.description ?? null,
      periodLabel: data.periodLabel ?? null,
      dueDate: data.dueDate ?? null,
      requestedById: ctx.user.id,
    },
  });

  await Promise.all([
    ctx.db.activity.create({
      data: {
        cabinetId: ctx.cabinet.id,
        clientId: data.clientId,
        actorId: ctx.user.id,
        type: "request.created",
        summary: `Pièce demandée : ${data.title}`,
        visibleToClient: true,
      },
    }),
    recordAudit({
      action: "request.created",
      cabinetId: ctx.cabinet.id,
      userId: ctx.user.id,
      resourceType: "DocumentRequest",
      resourceId: request.id,
      metadata: { clientId: data.clientId, title: data.title },
      ip: ctx.ip,
    }),
    notifyClientContacts(ctx, data.clientId, {
      type: "request.created",
      title: "Nouvelle pièce demandée",
      body: data.title,
      link: `/portal/requests/${request.id}`,
    }),
  ]);

  return request;
}

/** Dépôt d'une pièce par le client depuis le portail (ou par le cabinet pour lui). */
export async function submitRequest(ctx: AuthContext, requestId: string, file: UploadFile) {
  const request = await ctx.db.documentRequest.findFirst({ where: { id: requestId } });
  if (!request) throw new NotFoundError("Demande");
  if (request.status !== "pending" && request.status !== "rejected") {
    throw new ValidationError("Cette demande n'attend plus de document.");
  }

  const document = await uploadDocument(ctx, { clientId: request.clientId }, file);

  const updated = await ctx.db.documentRequest.update({
    where: { id: requestId },
    data: { status: "submitted", documentId: document.id, submittedAt: new Date(), rejectionReason: null },
  });

  await Promise.all([
    ctx.db.activity.create({
      data: {
        cabinetId: ctx.cabinet.id,
        clientId: request.clientId,
        actorId: ctx.user.id,
        type: "request.submitted",
        summary: `Pièce déposée : ${request.title}`,
        visibleToClient: true,
      },
    }),
    recordAudit({
      action: "request.submitted",
      cabinetId: ctx.cabinet.id,
      userId: ctx.user.id,
      resourceType: "DocumentRequest",
      resourceId: requestId,
      ip: ctx.ip,
    }),
    notifyCabinetOwners(ctx, {
      type: "request.submitted",
      title: "Document reçu",
      body: request.title,
      link: `/requests/${requestId}`,
    }),
  ]);

  return updated;
}

export async function reviewRequest(ctx: AuthContext, input: unknown) {
  const data = reviewSchema.parse(input);
  const request = await ctx.db.documentRequest.findFirst({ where: { id: data.requestId } });
  if (!request) throw new NotFoundError("Demande");
  if (request.status !== "submitted") {
    throw new ValidationError("Seule une pièce déposée peut être validée ou refusée.");
  }
  if (data.decision === "reject" && !data.reason) {
    throw new ValidationError("Indiquez au client la raison du refus.");
  }

  const approved = data.decision === "approve";
  const updated = await ctx.db.documentRequest.update({
    where: { id: data.requestId },
    data: {
      status: approved ? "approved" : "rejected",
      reviewedById: ctx.user.id,
      reviewedAt: new Date(),
      rejectionReason: approved ? null : (data.reason ?? null),
      // Un refus rouvre la demande côté client : le document reste attaché comme trace.
    },
  });

  if (request.documentId) {
    await ctx.db.document.updateMany({
      where: { id: request.documentId },
      data: { status: approved ? "approved" : "rejected" },
    });
  }

  await Promise.all([
    ctx.db.activity.create({
      data: {
        cabinetId: ctx.cabinet.id,
        clientId: request.clientId,
        actorId: ctx.user.id,
        type: approved ? "request.approved" : "request.rejected",
        summary: approved
          ? `Pièce validée : ${request.title}`
          : `Pièce refusée : ${request.title} — ${data.reason}`,
        visibleToClient: true,
      },
    }),
    recordAudit({
      action: approved ? "request.approved" : "request.rejected",
      cabinetId: ctx.cabinet.id,
      userId: ctx.user.id,
      resourceType: "DocumentRequest",
      resourceId: data.requestId,
      ip: ctx.ip,
    }),
    notifyClientContacts(ctx, request.clientId, {
      type: approved ? "request.approved" : "request.rejected",
      title: approved ? "Pièce validée" : "Pièce à renvoyer",
      body: approved ? request.title : `${request.title} — ${data.reason}`,
      link: `/portal/requests/${request.id}`,
    }),
  ]);

  return updated;
}

export async function listRequests(
  ctx: AuthContext,
  filters: { clientId?: string; status?: string } = {},
) {
  const where: Record<string, unknown> = {};
  if (filters.clientId) where.clientId = filters.clientId;
  if (filters.status && filters.status !== "all") where.status = filters.status;

  return ctx.db.documentRequest.findMany({
    where,
    orderBy: [{ status: "asc" }, { dueDate: "asc" }],
    include: {
      client: { select: { id: true, legalName: true } },
      document: { select: { id: true, filename: true, mimeType: true } },
    },
    take: 200,
  });
}

// --- notifications internes ---------------------------------------------------

async function notifyClientContacts(
  ctx: AuthContext,
  clientId: string,
  payload: { type: string; title: string; body: string; link: string },
) {
  const portalUsers = await ctx.db.membership.findMany({
    where: { clientId, role: "client", status: "active" },
    select: { userId: true },
  });
  await Promise.all(
    portalUsers.map((member) =>
      notify(ctx.cabinet.id, member.userId, payload).catch(() => undefined),
    ),
  );
}

async function notifyCabinetOwners(
  ctx: AuthContext,
  payload: { type: string; title: string; body: string; link: string },
) {
  const staff = await ctx.db.membership.findMany({
    where: { role: { in: ["owner", "admin", "accountant"] }, status: "active" },
    select: { userId: true },
    take: 20,
  });
  await Promise.all(
    staff.map((member) => notify(ctx.cabinet.id, member.userId, payload).catch(() => undefined)),
  );
}
