"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requirePermission, requirePortal, requireStaff } from "@/lib/authz/guard";
import { toPublicError } from "@/lib/errors";
import { markAllNotificationsRead, markNotificationRead } from "@/lib/notifications/service";
import { archiveClient, assignCollaborator, createClient, updateClient } from "@/server/services/clients";
import { deleteDocument, setDocumentStatus, uploadDocument } from "@/server/services/documents";
import { generateForYear, logOutageAttempt, setManagedBy, updateDeadlineStatus } from "@/server/services/deadlines";
import { createInvoice, recordPayment } from "@/server/services/invoices";
import { createRequest, reviewRequest, submitRequest } from "@/server/services/requests";
import { createTask, updateTask } from "@/server/services/tasks";

/**
 * Actions serveur.
 *
 * Chaque action commence par une vérification de permission ; aucune ne fait confiance à
 * un identifiant reçu du navigateur sans le repasser par le client Prisma du contexte.
 */

export type ActionState = {
  error?: string;
  fieldErrors?: Record<string, string[]>;
  ok?: boolean;
  message?: string;
};

function fail(error: unknown): ActionState {
  const { message, fieldErrors } = toPublicError(error);
  return { error: message, fieldErrors };
}

const str = (form: FormData, key: string) => {
  const value = form.get(key);
  return typeof value === "string" && value.length > 0 ? value : undefined;
};

// --- clients -----------------------------------------------------------------

export async function createClientAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  let id: string;
  try {
    const ctx = await requireStaff("client.create");
    const client = await createClient(ctx, {
      kind: str(form, "kind"),
      subtype: str(form, "subtype"),
      legalName: str(form, "legalName"),
      tradeName: str(form, "tradeName"),
      ice: str(form, "ice"),
      if: str(form, "if"),
      rc: str(form, "rc"),
      city: str(form, "city"),
      phone: str(form, "phone"),
      email: str(form, "email"),
      activity: str(form, "activity"),
      vatRegime: str(form, "vatRegime"),
      taxRegime: str(form, "taxRegime"),
      isEmployer: form.get("isEmployer") === "on",
      fiscalYearEndMonth: str(form, "fiscalYearEndMonth") ?? 12,
      fiscalYearEndDay: str(form, "fiscalYearEndDay") ?? 31,
      takeoverDate: str(form, "takeoverDate") ?? new Date().toISOString(),
      feeAmount: str(form, "feeAmount") ? Number(str(form, "feeAmount")) * 100 : undefined,
      feeFrequency: str(form, "feeFrequency"),
    });
    id = client.id;
  } catch (error) {
    return fail(error);
  }
  revalidatePath("/clients");
  redirect(`/clients/${id}`);
}

export async function updateClientAction(
  clientId: string,
  _prev: ActionState,
  form: FormData,
): Promise<ActionState> {
  try {
    const ctx = await requireStaff("client.update");
    await updateClient(ctx, clientId, Object.fromEntries(form.entries()));
    revalidatePath(`/clients/${clientId}`);
    return { ok: true, message: "Dossier mis à jour." };
  } catch (error) {
    return fail(error);
  }
}

export async function archiveClientAction(clientId: string): Promise<ActionState> {
  try {
    const ctx = await requireStaff("client.delete");
    await archiveClient(ctx, clientId);
    revalidatePath("/clients");
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}

export async function assignClientAction(clientId: string, userId: string): Promise<ActionState> {
  try {
    const ctx = await requireStaff("client.assign");
    await assignCollaborator(ctx, { clientId, userId });
    revalidatePath(`/clients/${clientId}`);
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}

// --- documents ---------------------------------------------------------------

async function fileFromForm(form: FormData) {
  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) return null;
  return {
    name: file.name,
    type: file.type || "application/octet-stream",
    buffer: Buffer.from(await file.arrayBuffer()),
  };
}

export async function uploadDocumentAction(
  _prev: ActionState,
  form: FormData,
): Promise<ActionState> {
  try {
    const ctx = await requirePermission("document.upload");
    const file = await fileFromForm(form);
    if (!file) return { error: "Sélectionnez un fichier." };

    await uploadDocument(
      ctx,
      {
        clientId: str(form, "clientId"),
        categoryId: str(form, "categoryId"),
        documentDate: str(form, "documentDate"),
        expiresAt: str(form, "expiresAt"),
        notes: str(form, "notes"),
      },
      file,
    );
    revalidatePath(`/clients/${str(form, "clientId") ?? ""}`);
    revalidatePath("/documents");
    return { ok: true, message: "Document ajouté." };
  } catch (error) {
    return fail(error);
  }
}

export async function setDocumentStatusAction(
  documentId: string,
  status: "approved" | "rejected" | "archived",
): Promise<ActionState> {
  try {
    const ctx = await requireStaff("document.approve");
    await setDocumentStatus(ctx, documentId, status);
    revalidatePath("/documents");
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}

export async function deleteDocumentAction(documentId: string): Promise<ActionState> {
  try {
    const ctx = await requireStaff("document.delete");
    await deleteDocument(ctx, documentId);
    revalidatePath("/documents");
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}

// --- demandes de pièces ------------------------------------------------------

export async function createRequestAction(
  _prev: ActionState,
  form: FormData,
): Promise<ActionState> {
  try {
    const ctx = await requireStaff("request.create");
    await createRequest(ctx, {
      clientId: str(form, "clientId"),
      title: str(form, "title"),
      description: str(form, "description"),
      periodLabel: str(form, "periodLabel"),
      dueDate: str(form, "dueDate"),
    });
    revalidatePath("/requests");
    revalidatePath(`/clients/${str(form, "clientId") ?? ""}`);
    return { ok: true, message: "Demande envoyée au client." };
  } catch (error) {
    return fail(error);
  }
}

export async function reviewRequestAction(
  requestId: string,
  decision: "approve" | "reject",
  reason?: string,
): Promise<ActionState> {
  try {
    const ctx = await requireStaff("request.review");
    await reviewRequest(ctx, { requestId, decision, reason });
    revalidatePath("/requests");
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}

/** Dépôt d'une pièce depuis le portail client. */
export async function submitRequestAction(
  _prev: ActionState,
  form: FormData,
): Promise<ActionState> {
  try {
    const ctx = await requirePortal();
    const file = await fileFromForm(form);
    if (!file) return { error: "Sélectionnez un fichier." };
    const requestId = str(form, "requestId");
    if (!requestId) return { error: "Demande introuvable." };
    await submitRequest(ctx, requestId, file);
    revalidatePath("/portal");
    return { ok: true, message: "Document envoyé à votre cabinet." };
  } catch (error) {
    return fail(error);
  }
}

// --- échéances ---------------------------------------------------------------

export async function generateDeadlinesAction(year: number): Promise<ActionState> {
  try {
    const ctx = await requireStaff("deadline.generate");
    const result = await generateForYear(ctx, { year });
    revalidatePath("/deadlines");
    return {
      ok: true,
      message: `${result.created} échéance(s) générée(s) pour ${result.clients} dossier(s).`,
    };
  } catch (error) {
    return fail(error);
  }
}

export async function updateDeadlineAction(
  deadlineId: string,
  action: "declare" | "pay" | "reopen" | "not_applicable",
  options: { proofDocumentId?: string; notes?: string } = {},
): Promise<ActionState> {
  try {
    const ctx = await requireStaff("deadline.update");
    await updateDeadlineStatus(ctx, { deadlineId, action, ...options });
    revalidatePath("/deadlines");
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}

export async function setDeadlineManagedByAction(
  deadlineId: string,
  managedBy: "cabinet" | "client" | "third_party",
): Promise<ActionState> {
  try {
    const ctx = await requireStaff("deadline.update");
    await setManagedBy(ctx, { deadlineId, managedBy });
    revalidatePath("/deadlines");
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}

/**
 * Pièces du dossier proposables comme preuve de dépôt.
 * La lecture passe par `ctx.db` : un dossier d'un autre cabinet ne renvoie rien.
 */
export async function listProofCandidatesAction(
  clientId: string,
): Promise<{ error?: string; items?: { id: string; filename: string }[] }> {
  try {
    const ctx = await requireStaff("deadline.update");
    const items = await ctx.db.document.findMany({
      where: { clientId },
      orderBy: { createdAt: "desc" },
      select: { id: true, filename: true },
      take: 100,
    });
    return { items };
  } catch (error) {
    return { error: toPublicError(error).message };
  }
}

export async function logOutageAction(
  deadlineId: string,
  portal: string,
  message: string,
): Promise<ActionState> {
  try {
    const ctx = await requireStaff("deadline.update");
    await logOutageAttempt(ctx, deadlineId, { portal, message });
    revalidatePath("/deadlines");
    return { ok: true, message: "Tentative horodatée et enregistrée." };
  } catch (error) {
    return fail(error);
  }
}

// --- tâches ------------------------------------------------------------------

export async function createTaskAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  try {
    const ctx = await requireStaff("task.create");
    await createTask(ctx, {
      clientId: str(form, "clientId"),
      title: str(form, "title"),
      description: str(form, "description"),
      priority: str(form, "priority") ?? "normal",
      dueDate: str(form, "dueDate"),
      assigneeId: str(form, "assigneeId"),
    });
    revalidatePath("/tasks");
    return { ok: true, message: "Tâche créée." };
  } catch (error) {
    return fail(error);
  }
}

export async function updateTaskStatusAction(taskId: string, status: string): Promise<ActionState> {
  try {
    const ctx = await requirePermission("task.update");
    await updateTask(ctx, taskId, { status });
    revalidatePath("/tasks");
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}

// --- honoraires --------------------------------------------------------------

export async function createInvoiceAction(
  _prev: ActionState,
  form: FormData,
): Promise<ActionState> {
  try {
    const ctx = await requireStaff("invoice.manage");
    await createInvoice(ctx, {
      clientId: str(form, "clientId"),
      reference: str(form, "reference"),
      label: str(form, "label"),
      amount: Number(str(form, "amount") ?? 0) * 100,
      vatRate: str(form, "vatRate") ?? 20,
      issuedAt: str(form, "issuedAt") ?? new Date().toISOString(),
      dueDate: str(form, "dueDate") ?? new Date().toISOString(),
    });
    revalidatePath("/invoices");
    return { ok: true, message: "Facture enregistrée." };
  } catch (error) {
    return fail(error);
  }
}

export async function recordPaymentAction(
  _prev: ActionState,
  form: FormData,
): Promise<ActionState> {
  try {
    const ctx = await requireStaff("invoice.manage");
    await recordPayment(ctx, {
      invoiceId: str(form, "invoiceId"),
      amount: Number(str(form, "amount") ?? 0) * 100,
      paidAt: str(form, "paidAt") ?? new Date().toISOString(),
      paymentMode: str(form, "paymentMode") ?? "transfer",
    });
    revalidatePath("/invoices");
    return { ok: true, message: "Encaissement enregistré." };
  } catch (error) {
    return fail(error);
  }
}

// --- notifications -----------------------------------------------------------

export async function readNotificationAction(notificationId: string): Promise<ActionState> {
  const ctx = await requirePermission("cabinet.view").catch(() => null);
  if (!ctx) return { error: "Session expirée." };
  await markNotificationRead(ctx.user.id, notificationId);
  revalidatePath("/notifications");
  return { ok: true };
}

export async function readAllNotificationsAction(): Promise<ActionState> {
  const ctx = await requirePermission("cabinet.view").catch(() => null);
  if (!ctx) return { error: "Session expirée." };
  await markAllNotificationsRead(ctx.user.id);
  revalidatePath("/notifications");
  return { ok: true };
}
