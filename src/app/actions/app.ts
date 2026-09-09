"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requirePermission, requirePortal, requireStaff } from "@/lib/authz/guard";
import { env } from "@/lib/env";
import { toPublicError } from "@/lib/errors";
import { markAllNotificationsRead, markNotificationRead } from "@/lib/notifications/service";
import { archiveClient, assignCollaborator, createClient, updateClient } from "@/server/services/clients";
import { deleteDocument, replaceFieldScan, setDocumentStatus, uploadDocument } from "@/server/services/documents";
import { generateForYear, logOutageAttempt, setManagedBy, updateDeadlineStatus } from "@/server/services/deadlines";
import { createInvoice, recordPayment } from "@/server/services/invoices";
import { createRequest, reviewRequest, submitRequest } from "@/server/services/requests";
import {
  completeAppointment,
  createAppointment,
  deleteAppointment,
  setAppointmentStatus,
  updateAppointment,
} from "@/server/services/appointments";
import {
  createIntervention,
  deleteIntervention,
  updateIntervention,
} from "@/server/services/interventions";
import { createTask, updateTask } from "@/server/services/tasks";
import {
  approveTodo,
  createTodo,
  deleteTodo,
  returnTodo,
  submitTodo,
  updateTodo,
} from "@/server/services/todos";
import {
  updateCabinetSettings,
  inviteMember,
  removeMember,
  revokeInvitation,
  unassignCollaborator,
  updateMember,
} from "@/server/services/members";

/**
 * Actions serveur.
 *
 * Chaque action commence par une vérification de permission ; aucune ne fait confiance à
 * un identifiant reçu du navigateur sans le repasser par le client Prisma du contexte.
 */

export type ActionState = {
  error?: string;
  fieldErrors?: Record<string, string[]>;
  /** Saisie renvoyée telle quelle pour repeupler le formulaire après un refus. */
  values?: Record<string, string>;
  ok?: boolean;
  message?: string;
};

/**
 * Champs texte du formulaire, pour les réafficher après une erreur.
 * Les fichiers sont exclus (non réaffichables) ainsi que les champs internes de
 * Next, et rien n'est renvoyé qui n'ait déjà été soumis par l'utilisateur.
 */
function formValues(form: FormData): Record<string, string> {
  const values: Record<string, string> = {};
  for (const [key, value] of form.entries()) {
    if (typeof value !== "string") continue;
    if (key.startsWith("$ACTION")) continue;
    values[key] = value;
  }
  return values;
}

function fail(error: unknown): ActionState {
  const { message, fieldErrors } = toPublicError(error);
  return { error: message, fieldErrors };
}

const str = (form: FormData, key: string) => {
  const value = form.get(key);
  return typeof value === "string" && value.length > 0 ? value : undefined;
};

// --- clients -----------------------------------------------------------------

/**
 * Lignes d'un groupe répétable (`branches.0.number`, `partners.1.cin`…).
 *
 * Le nombre de lignes est envoyé par le formulaire ; il est borné ici pour
 * qu'un compteur forgé ne fasse pas tourner la boucle indéfiniment. Le maximum
 * réel est celui du schéma, qui refusera au-delà.
 */
const MAX_ROWS = 200;

function rows(form: FormData, name: string, keys: readonly string[]) {
  const declared = Number(form.get(`${name}.count`) ?? 0);
  const count = Number.isFinite(declared) ? Math.min(Math.max(declared, 0), MAX_ROWS) : 0;
  return Array.from({ length: count }, (_, index) =>
    Object.fromEntries(keys.map((key) => [key, str(form, `${name}.${index}.${key}`)])),
  );
}

/** Liste de valeurs simples : les lignes vidées à l'écran sont ignorées. */
function textList(form: FormData, name: string): string[] {
  return rows(form, name, ["value"])
    .map((row) => row.value)
    .filter((value): value is string => Boolean(value));
}

/**
 * Immatriculations, avec leurs établissements et leurs numéros de taxe.
 *
 * Le formulaire aplatit l'arbre (`registrations.0.branches.1.taxProfNos.0.value`)
 * et porte un compteur à chaque niveau : `FormData` ne connaît que des paires
 * plates, et une convention explicite vaut mieux qu'un balayage de clés.
 */
function registrationList(form: FormData) {
  return rows(form, "registrations", ["id", "number", "court"])
    .map((registration, index) => ({
      id: registration.id,
      number: registration.number,
      court: registration.court,
      taxProfNos: taxList(form, `registrations.${index}.taxProfNos`),
      branches: rows(form, `registrations.${index}.branches`, ["id", "number", "court"])
        .map((branch, branchIndex) => ({
          id: branch.id,
          number: branch.number,
          court: branch.court,
          taxProfNos: taxList(form, `registrations.${index}.branches.${branchIndex}.taxProfNos`),
        }))
        .filter((branch) => branch.number),
    }))
    .filter((registration) => registration.number);
}

/** Numéros de taxe professionnelle : chacun garde son identifiant de ligne. */
function taxList(form: FormData, name: string) {
  return rows(form, name, ["id", "value"]).filter((row) => row.value);
}

/**
 * Saisie d'un dossier, lue depuis le formulaire.
 *
 * Champs listés explicitement plutôt que `Object.fromEntries` : une case
 * décochée n'est pas envoyée par le navigateur, et un schéma partiel
 * l'ignorerait — « employeur » n'aurait jamais pu être retiré. La lecture est
 * commune à la création et à la modification, faute de quoi un champ ajouté à
 * l'une resterait absent de l'autre.
 */
function clientInput(form: FormData) {
  return {
    kind: str(form, "kind"),
    subtype: str(form, "subtype"),
    subtypeOther: str(form, "subtypeOther"),
    legalName: str(form, "legalName"),
    tradeName: str(form, "tradeName"),
    ice: str(form, "ice"),
    if: str(form, "if"),
    rc: str(form, "rc"),
    rcCourt: str(form, "rcCourt"),
    cnssNo: str(form, "cnssNo"),
    managerCin: str(form, "managerCin"),
    address: str(form, "address"),
    city: str(form, "city"),
    phone: str(form, "phone"),
    email: str(form, "email"),
    website: str(form, "website"),
    vatRegime: str(form, "vatRegime"),
    taxRegime: str(form, "taxRegime"),
    isEmployer: form.get("isEmployer") === "on",
    fiscalYearEndMonth: str(form, "fiscalYearEndMonth"),
    fiscalYearEndDay: str(form, "fiscalYearEndDay"),
    takeoverDate: str(form, "takeoverDate"),
    feeAmount: str(form, "feeAmount") ? Number(str(form, "feeAmount")) * 100 : undefined,
    feeFrequency: str(form, "feeFrequency"),
    referredById: str(form, "referredById"),

    authorizationNo: str(form, "authorizationNo"),
    employeeCount: str(form, "employeeCount"),
    startedAt: str(form, "startedAt"),

    taxDistrict: str(form, "taxDistrict"),
    signNo: str(form, "signNo"),
    signRefDate: str(form, "signRefDate"),
    signExpiresAt: str(form, "signExpiresAt"),
    personalAddress: str(form, "personalAddress"),
    cnssRegNo: str(form, "cnssRegNo"),
    cnssAffiliatedAt: str(form, "cnssAffiliatedAt"),

    negCertNo: str(form, "negCertNo"),
    negCertDate: str(form, "negCertDate"),
    negCertExpiresAt: str(form, "negCertExpiresAt"),
    isDomiciled: form.get("isDomiciled") === "on",

    activities: textList(form, "activities"),
    // Une ligne sans son champ identifiant est une ligne ajoutée puis laissée
    // vide : elle est écartée plutôt que refusée, la corriger n'apporterait rien.
    registrations: registrationList(form),
    partners: rows(form, "partners", ["id", "role", "name", "cin", "phone", "address"]).filter(
      (row) => row.name,
    ),
    employees: rows(form, "employees", ["name", "cin", "cnssNo"]).filter((row) => row.name),
    // Un article n'a pas de champ obligatoire : il est conservé dès qu'une de
    // ses informations est saisie, et écarté s'il est resté entièrement vide.
    articles: rows(form, "articles", ["id", "number", "designation", "address", "usage"]).filter(
      (row) => row.number || row.designation || row.address,
    ),
  };
}

export async function createClientAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  let id: string;
  try {
    const ctx = await requireStaff("client.create");
    const input = clientInput(form);
    const client = await createClient(ctx, {
      ...input,
      fiscalYearEndMonth: input.fiscalYearEndMonth ?? 12,
      fiscalYearEndDay: input.fiscalYearEndDay ?? 31,
      takeoverDate: input.takeoverDate ?? new Date().toISOString(),
    });
    id = client.id;
  } catch (error) {
    return { ...fail(error), values: formValues(form) };
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
    await updateClient(ctx, clientId, clientInput(form));
    revalidatePath(`/clients/${clientId}`);
    revalidatePath("/clients");
    return { ok: true, message: "Dossier mis à jour." };
  } catch (error) {
    return { ...fail(error), values: formValues(form) };
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

/**
 * Justificatif d'un champ de la fiche.
 *
 * Un dépôt par requête, déclenché dès le choix du fichier : la fiche compte une
 * dizaine de pièces possibles, les envoyer toutes dans la soumission du
 * formulaire aurait fait un corps de requête de plusieurs centaines de
 * mégaoctets, et une erreur aurait emporté la saisie avec elle.
 */
export async function uploadFieldScanAction(
  form: FormData,
): Promise<ActionState & { document?: { id: string; filename: string } }> {
  const clientId = str(form, "clientId");
  try {
    const ctx = await requirePermission("document.upload");
    const file = await fileFromForm(form);
    if (!file) return { error: "Sélectionnez un fichier." };

    const document = await replaceFieldScan(
      ctx,
      { clientId, fieldKey: str(form, "fieldKey") },
      file,
    );
    // Pas de `revalidatePath` ici. Il rafraîchit l'arbre de la route en cours,
    // donc remonte le formulaire de la fiche — et les identifiants des lignes
    // ajoutées à l'écran mais pas encore enregistrées sont réémis : le
    // justificatif qui vient d'être déposé se retrouverait rattaché à une ligne
    // qui n'existe plus. Les pages concernées sont `force-dynamic`, elles se
    // rechargent de toute façon à la navigation, et le composant met à jour son
    // propre affichage avec le document renvoyé.
    return {
      ok: true,
      message: "Justificatif enregistré.",
      document: { id: document.id, filename: document.filename },
    };
  } catch (error) {
    return fail(error);
  }
}

// --- liste de tâches de l'équipe ----------------------------------------------

function todoInput(form: FormData) {
  return {
    assigneeId: str(form, "assigneeId"),
    title: str(form, "title"),
    details: str(form, "details"),
    dueDate: str(form, "dueDate"),
    priority: str(form, "priority") ?? "normal",
    clientId: str(form, "clientId"),
  };
}

export async function createTodoAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  try {
    const ctx = await requirePermission("todo.manage");
    await createTodo(ctx, todoInput(form));
    revalidatePath("/todos");
    revalidatePath("/dashboard");
    return { ok: true, message: "Tâche confiée." };
  } catch (error) {
    return { ...fail(error), values: formValues(form) };
  }
}

export async function updateTodoAction(
  todoId: string,
  _prev: ActionState,
  form: FormData,
): Promise<ActionState> {
  try {
    const ctx = await requirePermission("todo.manage");
    await updateTodo(ctx, todoId, todoInput(form));
    revalidatePath("/todos");
    return { ok: true, message: "Tâche mise à jour." };
  } catch (error) {
    return { ...fail(error), values: formValues(form) };
  }
}

/**
 * Le collaborateur rend sa tâche.
 *
 * Autorisé par `todo.view` : c'est l'acte de celui à qui la tâche est confiée,
 * et le service vérifie que c'est bien lui.
 */
export async function submitTodoAction(
  todoId: string,
  _prev: ActionState,
  form: FormData,
): Promise<ActionState> {
  try {
    const ctx = await requirePermission("todo.view");
    await submitTodo(ctx, todoId, { note: str(form, "note") });
    revalidatePath("/todos");
    revalidatePath("/dashboard");
    return { ok: true, message: "Tâche rendue. En attente de confirmation." };
  } catch (error) {
    return { ...fail(error), values: formValues(form) };
  }
}

export async function approveTodoAction(todoId: string): Promise<ActionState> {
  try {
    const ctx = await requirePermission("todo.manage");
    await approveTodo(ctx, todoId);
    revalidatePath("/todos");
    revalidatePath("/dashboard");
    return { ok: true, message: "Tâche confirmée." };
  } catch (error) {
    return fail(error);
  }
}

export async function returnTodoAction(
  todoId: string,
  _prev: ActionState,
  form: FormData,
): Promise<ActionState> {
  try {
    const ctx = await requirePermission("todo.manage");
    await returnTodo(ctx, todoId, { note: str(form, "note") });
    revalidatePath("/todos");
    revalidatePath("/dashboard");
    return { ok: true, message: "Tâche renvoyée au collaborateur." };
  } catch (error) {
    return { ...fail(error), values: formValues(form) };
  }
}

export async function deleteTodoAction(todoId: string): Promise<ActionState> {
  try {
    const ctx = await requirePermission("todo.manage");
    await deleteTodo(ctx, todoId);
    revalidatePath("/todos");
    return { ok: true, message: "Tâche retirée." };
  } catch (error) {
    return fail(error);
  }
}

// --- rendez-vous ---------------------------------------------------------------

function appointmentInput(form: FormData) {
  return {
    clientId: str(form, "clientId"),
    title: str(form, "title"),
    startsAt: str(form, "startsAt"),
    durationMinutes: str(form, "durationMinutes") ?? 30,
    mode: str(form, "mode"),
    location: str(form, "location"),
    preparation: str(form, "preparation"),
    assignedToId: str(form, "assignedToId"),
  };
}

export async function createAppointmentAction(
  _prev: ActionState,
  form: FormData,
): Promise<ActionState> {
  try {
    const ctx = await requirePermission("appointment.manage");
    await createAppointment(ctx, appointmentInput(form));
    revalidatePath("/appointments");
    revalidatePath(`/clients/${str(form, "clientId") ?? ""}`);
    return { ok: true, message: "Rendez-vous enregistré." };
  } catch (error) {
    return { ...fail(error), values: formValues(form) };
  }
}

export async function updateAppointmentAction(
  appointmentId: string,
  _prev: ActionState,
  form: FormData,
): Promise<ActionState> {
  try {
    const ctx = await requirePermission("appointment.manage");
    await updateAppointment(ctx, appointmentId, appointmentInput(form));
    revalidatePath("/appointments");
    revalidatePath(`/clients/${str(form, "clientId") ?? ""}`);
    return { ok: true, message: "Rendez-vous mis à jour." };
  } catch (error) {
    return { ...fail(error), values: formValues(form) };
  }
}

/**
 * Validation d'un rendez-vous honoré.
 *
 * Le compte rendu ne reste pas dans le calendrier : il devient une ligne de la
 * liste d'activité du client, là où le comptable relit ce qui a été fait.
 */
export async function completeAppointmentAction(
  appointmentId: string,
  _prev: ActionState,
  form: FormData,
): Promise<ActionState> {
  try {
    const ctx = await requirePermission("appointment.manage");
    await completeAppointment(ctx, appointmentId, {
      outcome: str(form, "outcome"),
      reason: str(form, "reason"),
    });
    revalidatePath("/appointments");
    revalidatePath(`/clients/${str(form, "clientId") ?? ""}`);
    return { ok: true, message: "Rendez-vous validé et versé à la liste d'activité." };
  } catch (error) {
    return { ...fail(error), values: formValues(form) };
  }
}

export async function setAppointmentStatusAction(
  appointmentId: string,
  status: "cancelled" | "no_show" | "scheduled",
): Promise<ActionState> {
  try {
    const ctx = await requirePermission("appointment.manage");
    await setAppointmentStatus(ctx, appointmentId, status);
    revalidatePath("/appointments");
    return { ok: true, message: "Rendez-vous mis à jour." };
  } catch (error) {
    return fail(error);
  }
}

export async function deleteAppointmentAction(appointmentId: string): Promise<ActionState> {
  try {
    const ctx = await requirePermission("appointment.manage");
    await deleteAppointment(ctx, appointmentId);
    revalidatePath("/appointments");
    return { ok: true, message: "Rendez-vous supprimé." };
  } catch (error) {
    return fail(error);
  }
}

// --- registre des services rendus --------------------------------------------

/**
 * Enregistre un service rendu au client.
 *
 * Le registre est écrit à la main par le cabinet : il ne se déduit d'aucune
 * autre table, et c'est lui que le comptable relit — et imprime — pour savoir ce
 * qu'il a fait pour un dossier.
 */
export async function createInterventionAction(
  _prev: ActionState,
  form: FormData,
): Promise<ActionState> {
  const clientId = str(form, "clientId");
  try {
    const ctx = await requirePermission("intervention.manage");
    await createIntervention(ctx, {
      clientId,
      service: str(form, "service"),
      performedAt: str(form, "performedAt") ?? new Date().toISOString(),
      reason: str(form, "reason"),
      report: str(form, "report"),
    });
    revalidatePath(`/clients/${clientId ?? ""}`);
    return { ok: true, message: "Service enregistré." };
  } catch (error) {
    return { ...fail(error), values: formValues(form) };
  }
}

export async function updateInterventionAction(
  interventionId: string,
  _prev: ActionState,
  form: FormData,
): Promise<ActionState> {
  const clientId = str(form, "clientId");
  try {
    const ctx = await requirePermission("intervention.manage");
    await updateIntervention(ctx, interventionId, {
      service: str(form, "service"),
      performedAt: str(form, "performedAt") ?? new Date().toISOString(),
      reason: str(form, "reason"),
      report: str(form, "report"),
    });
    revalidatePath(`/clients/${clientId ?? ""}`);
    return { ok: true, message: "Service mis à jour." };
  } catch (error) {
    return { ...fail(error), values: formValues(form) };
  }
}

export async function deleteInterventionAction(
  interventionId: string,
  clientId: string,
): Promise<ActionState> {
  try {
    const ctx = await requirePermission("intervention.manage");
    await deleteIntervention(ctx, interventionId);
    revalidatePath(`/clients/${clientId}`);
    return { ok: true, message: "Service retiré." };
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
    revalidatePath("/dashboard");
    return { ok: true, message: "Tâche créée." };
  } catch (error) {
    return { ...fail(error), values: formValues(form) };
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
    revalidatePath("/dashboard");
    return { ok: true, message: "Facture enregistrée." };
  } catch (error) {
    return { ...fail(error), values: formValues(form) };
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
    revalidatePath("/dashboard");
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
  // Le compteur non lu vit dans la coquille de l'application, pas dans la page.
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function readAllNotificationsAction(): Promise<ActionState> {
  const ctx = await requirePermission("cabinet.view").catch(() => null);
  if (!ctx) return { error: "Session expirée." };
  await markAllNotificationsRead(ctx.user.id);
  revalidatePath("/", "layout");
  return { ok: true };
}

// --- équipe ------------------------------------------------------------------

/**
 * Invite un collaborateur et renvoie le lien d'acceptation.
 *
 * Le lien n'est affiché qu'une fois : la base ne garde que l'empreinte du jeton.
 * L'envoi par courriel n'est pas branché (`EMAIL_PROVIDER=console` en
 * développement), l'administrateur transmet donc le lien lui-même.
 */
export async function inviteMemberAction(
  _prev: ActionState & { inviteUrl?: string },
  form: FormData,
): Promise<ActionState & { inviteUrl?: string }> {
  try {
    const ctx = await requireStaff("member.invite");
    const { token } = await inviteMember(ctx, {
      email: str(form, "email"),
      role: str(form, "role"),
      restrictedToAssigned: form.get("restrictedToAssigned") === "on",
    });
    revalidatePath("/team");
    return {
      ok: true,
      message: "Invitation créée. Transmettez le lien ci-dessous.",
      inviteUrl: `${env().APP_URL}/invitation/${token}`,
    };
  } catch (error) {
    return { ...fail(error), values: formValues(form) };
  }
}

export async function updateMemberAction(
  membershipId: string,
  role: string,
  restrictedToAssigned: boolean,
): Promise<ActionState> {
  try {
    const ctx = await requireStaff("member.manage");
    await updateMember(ctx, membershipId, { role, restrictedToAssigned });
    revalidatePath("/team");
    return { ok: true, message: "Droits mis à jour." };
  } catch (error) {
    return fail(error);
  }
}

export async function removeMemberAction(membershipId: string): Promise<ActionState> {
  try {
    const ctx = await requireStaff("member.manage");
    await removeMember(ctx, membershipId);
    revalidatePath("/team");
    return { ok: true, message: "Collaborateur retiré." };
  } catch (error) {
    return fail(error);
  }
}

export async function revokeInvitationAction(invitationId: string): Promise<ActionState> {
  try {
    const ctx = await requireStaff("member.invite");
    await revokeInvitation(ctx, invitationId);
    revalidatePath("/team");
    return { ok: true, message: "Invitation annulée." };
  } catch (error) {
    return fail(error);
  }
}

export async function unassignClientAction(clientId: string, userId: string): Promise<ActionState> {
  try {
    const ctx = await requireStaff("client.assign");
    await unassignCollaborator(ctx, clientId, userId);
    revalidatePath(`/clients/${clientId}`);
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}

/** Réglages du cabinet, réservés à qui peut le gérer. */
export async function updateCabinetSettingsAction(
  _prev: ActionState,
  form: FormData,
): Promise<ActionState> {
  try {
    const ctx = await requireStaff("cabinet.manage");
    await updateCabinetSettings(ctx, {
      name: str(form, "name"),
      ice: str(form, "ice"),
      if: str(form, "if"),
      rc: str(form, "rc"),
      ordre: str(form, "ordre"),
      ordreNum: str(form, "ordreNum"),
      city: str(form, "city"),
      phone: str(form, "phone"),
      email: str(form, "email"),
      cndpMode: str(form, "cndpMode"),
      cndpRef: str(form, "cndpRef"),
    });
    revalidatePath("/settings");
    revalidatePath("/", "layout");
    return { ok: true, message: "Réglages enregistrés." };
  } catch (error) {
    return { ...fail(error), values: formValues(form) };
  }
}
