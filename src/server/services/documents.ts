import { z } from "zod";
import { recordAudit } from "@/lib/audit";
import type { AuthContext } from "@/lib/authz/guard";
import { requireClient } from "@/lib/authz/guard";
import { assertWithinLimit } from "@/lib/billing/entitlements";
import { platformDb } from "@/lib/db/tenant";
import { NotFoundError, ValidationError } from "@/lib/errors";
import { deleteFile, fileExists, putFile, readFileStream } from "@/lib/storage";
import { searchSchema } from "@/lib/validation/schemas";

const uploadSchema = z.object({
  clientId: z.string().min(1).optional(),
  categoryId: z.string().optional(),
  documentDate: z.coerce.date().optional(),
  expiresAt: z.coerce.date().optional(),
  notes: z.string().trim().max(1000).optional(),
  requestId: z.string().optional(),
});

export type UploadFile = { name: string; type: string; buffer: Buffer };

/**
 * Téléversement d'un document.
 *
 * L'ordre compte : autorisation sur le dossier, puis limites du plan, puis validation du
 * fichier, puis écriture sur le stockage privé, puis métadonnées en base. Un fichier
 * écrit sans ligne en base est nettoyé.
 */
export async function uploadDocument(ctx: AuthContext, input: unknown, file: UploadFile) {
  const data = uploadSchema.parse(input);
  if (data.clientId) await requireClient(ctx, data.clientId);

  await assertWithinLimit(ctx.cabinet.id, "monthlyUploads");
  await assertWithinLimit(ctx.cabinet.id, "storageMb", Math.ceil(file.buffer.length / (1024 * 1024)));

  const stored = await putFile({
    cabinetId: ctx.cabinet.id,
    filename: file.name,
    mimeType: file.type,
    buffer: file.buffer,
  });

  try {
    const document = await ctx.db.document.create({
      data: {
        cabinetId: ctx.cabinet.id,
        clientId: data.clientId ?? null,
        categoryId: data.categoryId ?? null,
        filename: stored.filename,
        storageKey: stored.storageKey,
        mimeType: stored.mimeType,
        size: stored.size,
        checksum: stored.checksum,
        documentDate: data.documentDate ?? null,
        expiresAt: data.expiresAt ?? null,
        notes: data.notes ?? null,
        uploadedById: ctx.user.id,
        uploadedVia: ctx.membership.role === "client" ? "portal" : "cabinet",
        tags: "[]",
      },
    });

    // Le compteur de stockage sert aux limites du plan ; il est borné au cabinet courant.
    await platformDb.cabinet.update({
      where: { id: ctx.cabinet.id },
      data: { storageUsed: { increment: stored.size } },
    });

    await Promise.all([
      recordAudit({
        action: "document.uploaded",
        cabinetId: ctx.cabinet.id,
        userId: ctx.user.id,
        resourceType: "Document",
        resourceId: document.id,
        metadata: { filename: stored.filename, size: stored.size, clientId: data.clientId },
        ip: ctx.ip,
        userAgent: ctx.userAgent,
      }),
      data.clientId
        ? ctx.db.activity.create({
            data: {
              cabinetId: ctx.cabinet.id,
              clientId: data.clientId,
              actorId: ctx.user.id,
              type: "document.uploaded",
              summary: `Document reçu : ${stored.filename}`,
              visibleToClient: true,
            },
          })
        : Promise.resolve(),
    ]);

    return document;
  } catch (error) {
    await deleteFile(stored.storageKey).catch(() => undefined);
    throw error;
  }
}

export type DocumentFilters = {
  q?: string;
  page?: number | string;
  perPage?: number | string;
  clientId?: string;
  categoryId?: string;
  status?: string;
};

export async function listDocuments(ctx: AuthContext, input: DocumentFilters = {}) {
  const { q, page, perPage } = searchSchema.parse(input);
  const filters = input;

  const where: Record<string, unknown> = {};
  if (filters?.clientId) where.clientId = filters.clientId;
  if (filters?.categoryId) where.categoryId = filters.categoryId;
  if (filters?.status && filters.status !== "all") where.status = filters.status;
  if (q) where.filename = { contains: q };

  const [total, items] = await Promise.all([
    ctx.db.document.count({ where }),
    ctx.db.document.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * perPage,
      take: perPage,
      include: {
        client: { select: { id: true, legalName: true } },
        category: { select: { id: true, name: true } },
        uploadedBy: { select: { id: true, name: true } },
      },
    }),
  ]);

  return { items, total, page, perPage, pageCount: Math.max(1, Math.ceil(total / perPage)) };
}

/**
 * Prépare un téléchargement autorisé.
 *
 * Le document est cherché via le client Prisma du contexte : un identifiant appartenant à
 * un autre cabinet, ou à un dossier hors de la portée de l'utilisateur, est simplement
 * introuvable. Aucune URL publique n'existe : le flux passe par le serveur.
 */
export async function openDocument(ctx: AuthContext, documentId: string) {
  const document = await ctx.db.document.findFirst({ where: { id: documentId } });

  if (!document) {
    await recordAudit({
      action: "document.access_denied",
      cabinetId: ctx.cabinet.id,
      userId: ctx.user.id,
      resourceType: "Document",
      resourceId: documentId,
      ip: ctx.ip,
      userAgent: ctx.userAgent,
      outcome: "denied",
    });
    throw new NotFoundError("Document");
  }

  if (!(await fileExists(document.storageKey))) {
    throw new NotFoundError("Fichier");
  }

  await recordAudit({
    action: "document.downloaded",
    cabinetId: ctx.cabinet.id,
    userId: ctx.user.id,
    resourceType: "Document",
    resourceId: document.id,
    metadata: { filename: document.filename },
    ip: ctx.ip,
    userAgent: ctx.userAgent,
  });

  return { document, stream: readFileStream(document.storageKey) };
}

export async function setDocumentStatus(
  ctx: AuthContext,
  documentId: string,
  status: "approved" | "rejected" | "archived" | "received",
) {
  const document = await ctx.db.document.findFirst({ where: { id: documentId } });
  if (!document) throw new NotFoundError("Document");

  const updated = await ctx.db.document.update({ where: { id: documentId }, data: { status } });
  await recordAudit({
    action: `document.${status}`,
    cabinetId: ctx.cabinet.id,
    userId: ctx.user.id,
    resourceType: "Document",
    resourceId: documentId,
    ip: ctx.ip,
  });
  return updated;
}

export async function deleteDocument(ctx: AuthContext, documentId: string) {
  const document = await ctx.db.document.findFirst({ where: { id: documentId } });
  if (!document) throw new NotFoundError("Document");

  const usedAsProof = await ctx.db.deadline.count({ where: { proofDocumentId: documentId } });
  if (usedAsProof > 0) {
    throw new ValidationError(
      "Ce document sert de preuve de dépôt pour une échéance : détachez-le avant de le supprimer.",
    );
  }

  await ctx.db.document.delete({ where: { id: documentId } });
  await deleteFile(document.storageKey);
  await platformDb.cabinet.update({
    where: { id: ctx.cabinet.id },
    data: { storageUsed: { decrement: document.size } },
  });

  await recordAudit({
    action: "document.deleted",
    cabinetId: ctx.cabinet.id,
    userId: ctx.user.id,
    resourceType: "Document",
    resourceId: documentId,
    metadata: { filename: document.filename },
    ip: ctx.ip,
    userAgent: ctx.userAgent,
  });
}
