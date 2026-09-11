import { z } from "zod";
import { recordAudit } from "@/lib/audit";
import type { AuthContext } from "@/lib/authz/guard";
import { requireClient } from "@/lib/authz/guard";
import { assertWithinLimit } from "@/lib/billing/entitlements";
import { platformDb } from "@/lib/db/tenant";
import { NotFoundError, ValidationError } from "@/lib/errors";
import { deleteFile, fileExists, putFile, readFileStream } from "@/lib/storage";
import { documentSearchKey, normalizeSearch } from "@/lib/search";
import { searchSchema } from "@/lib/validation/schemas";

const uploadSchema = z.object({
  clientId: z.string().min(1).optional(),
  categoryId: z.string().optional(),
  documentDate: z.coerce.date().optional(),
  expiresAt: z.coerce.date().optional(),
  notes: z.string().trim().max(1000).optional(),
  requestId: z.string().optional(),
  /// Champ de la fiche justifié par la pièce (« cin », « rc:<id> »…).
  fieldKey: z
    .string()
    .trim()
    .regex(/^[a-zA-Z]+(:[A-Za-z0-9_-]{4,36})?$/, "Champ inconnu.")
    .optional()
    .or(z.literal("").transform(() => undefined)),
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
        fieldKey: data.fieldKey ?? null,
        filename: stored.filename,
        searchKey: documentSearchKey({ filename: stored.filename, notes: data.notes }),
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
  if (q) {
    where.AND = normalizeSearch(q)
      .split(" ")
      .filter(Boolean)
      .map((term) => ({ searchKey: { contains: term } }));
  }

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

  return { document, stream: await readFileStream(document.storageKey) };
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

/**
 * Justificatifs rattachés aux champs de la fiche, par champ.
 *
 * Un seul document actif par champ : la fiche montre la pièce en cours, pas un
 * historique. Le remplacement est géré au dépôt (voir `replaceFieldScan`).
 */
export async function fieldScans(ctx: AuthContext, clientId: string) {
  await requireClient(ctx, clientId);
  const rows = await ctx.db.document.findMany({
    where: { clientId, fieldKey: { not: null } },
    orderBy: { createdAt: "desc" },
    select: { id: true, fieldKey: true, filename: true, size: true, createdAt: true },
  });

  const byField = new Map<string, (typeof rows)[number]>();
  for (const row of rows) {
    if (row.fieldKey && !byField.has(row.fieldKey)) byField.set(row.fieldKey, row);
  }
  return byField;
}

/**
 * Dépose le justificatif d'un champ, en retirant celui qu'il remplace.
 *
 * L'ancienne pièce n'est supprimée qu'une fois la nouvelle enregistrée : en cas
 * d'échec du dépôt, la fiche garde le justificatif qu'elle avait.
 */
export async function replaceFieldScan(ctx: AuthContext, input: unknown, file: UploadFile) {
  const data = uploadSchema.parse(input);
  if (!data.clientId || !data.fieldKey) {
    throw new ValidationError("Justificatif sans dossier ni champ.");
  }

  const previous = await ctx.db.document.findMany({
    where: { clientId: data.clientId, fieldKey: data.fieldKey },
    select: { id: true },
  });

  const document = await uploadDocument(ctx, data, file);

  for (const old of previous) {
    // Une pièce qui sert de preuve de dépôt à une échéance est conservée :
    // `deleteDocument` la refuse, et la fiche n'a pas à trancher pour l'échéance.
    await deleteDocument(ctx, old.id).catch(() => undefined);
  }

  return document;
}

/**
 * Champs pour lesquels une pièce justificative est attendue.
 *
 * La liste dépend du type de personne : une société n'a ni CIN ni
 * immatriculation CNSS personnelle, un contribuable individuel n'a pas de
 * certificat négatif. Les lignes du registre de commerce s'y ajoutent, une par
 * immatriculation et par succursale.
 */
export type ExpectedScan = { key: string; label: string; attached: boolean };

export function expectedScans(
  client: Record<string, unknown>,
  scans: Map<string, unknown>,
): ExpectedScan[] {
  const individual = client.kind === "individual";
  const has = (key: string) => scans.has(key);

  const base: { key: string; label: string }[] = individual
    ? [
        { key: "cin", label: "CIN" },
        { key: "if", label: "Identifiant fiscal" },
        { key: "ice", label: "ICE" },
        { key: "sign", label: "Enseigne commerciale" },
        { key: "cnssReg", label: "Immatriculation CNSS" },
      ]
    : [
        { key: "statuts", label: "Statuts" },
        { key: "if", label: "Identifiant fiscal" },
        { key: "ice", label: "ICE" },
        { key: "negCert", label: "Certificat négatif" },
        { key: "siege", label: "Titre d'occupation du siège" },
      ];

  // Registre de commerce : une pièce par immatriculation et par succursale, et
  // une autorisation par établissement qui en déclare une.
  const registrations = parseJson<{
    id?: string;
    number?: string;
    authorizationNo?: string;
    branches?: { id?: string; number?: string; authorizationNo?: string }[];
  }>(client.registrations);

  if (client.cnssNo) base.push({ key: "cnssAffiliation", label: "Affiliation CNSS" });
  // Tant qu'aucun établissement ne porte d'autorisation, celle du dossier reste
  // la seule : sans registre, ou saisie avant le découpage par établissement.
  const treeAuthorized = registrations.some(
    (registration) =>
      Boolean(registration.authorizationNo) ||
      Boolean(registration.branches?.some((branch) => branch.authorizationNo)),
  );
  if (client.authorizationNo && !treeAuthorized) {
    base.push({ key: "authorization", label: "Autorisation" });
  }

  const rows = base.map((row) => ({ ...row, attached: has(row.key) }));

  registrations.forEach((registration, index) => {
    if (registration.id) {
      rows.push({
        key: `rc:${registration.id}`,
        label: `Registre ${registration.number ?? ""}`.trim(),
        attached: has(`rc:${registration.id}`),
      });
      if (registration.authorizationNo) {
        rows.push({
          key: `auth:${registration.id}`,
          label: `Autorisation — registre ${registration.number ?? ""}`.trim(),
          // Une pièce déposée quand l'autorisation valait pour tout le dossier
          // compte pour le premier registre, qui l'a reprise.
          attached: has(`auth:${registration.id}`) || (index === 0 && has("authorization")),
        });
      }
    }
    for (const branch of registration.branches ?? []) {
      if (!branch.id) continue;
      rows.push({
        key: `branch:${branch.id}`,
        label: `Succursale ${branch.number ?? ""}`.trim(),
        attached: has(`branch:${branch.id}`),
      });
      if (branch.authorizationNo) {
        rows.push({
          key: `auth:${branch.id}`,
          label: `Autorisation — succursale ${branch.number ?? ""}`.trim(),
          attached: has(`auth:${branch.id}`),
        });
      }
    }
  });

  return rows;
}

function parseJson<T>(raw: unknown): T[] {
  if (typeof raw !== "string" || raw.length === 0) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
}
