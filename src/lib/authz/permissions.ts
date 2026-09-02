import type { Role } from "@/lib/domain/enums";

/**
 * RBAC : liste fermée de permissions. Le refus est la valeur par défaut —
 * une permission absente de la table est refusée, y compris pour le propriétaire.
 */
export const PERMISSIONS = [
  "cabinet.view", "cabinet.manage", "cabinet.delete",
  "member.view", "member.invite", "member.manage",
  "client.view", "client.create", "client.update", "client.delete", "client.assign",
  "contact.manage",
  "document.view", "document.upload", "document.download", "document.delete", "document.approve",
  "request.view", "request.create", "request.review", "request.submit", "request.cancel",
  "task.view", "task.create", "task.update", "task.assign", "task.delete",
  "deadline.view", "deadline.create", "deadline.update", "deadline.generate",
  "invoice.view", "invoice.manage",
  "message.view", "message.send", "note.internal",
  "activity.view", "audit.view", "report.view",
  "billing.view", "billing.manage",
  "portal.access",
] as const;

export type Permission = (typeof PERMISSIONS)[number];

const ALL: Permission[] = [...PERMISSIONS];

const ACCOUNTANT: Permission[] = [
  "cabinet.view",
  "member.view",
  "client.view", "client.create", "client.update", "contact.manage",
  "document.view", "document.upload", "document.download", "document.delete", "document.approve",
  "request.view", "request.create", "request.review", "request.cancel",
  "task.view", "task.create", "task.update", "task.assign",
  "deadline.view", "deadline.create", "deadline.update", "deadline.generate",
  "invoice.view",
  "message.view", "message.send", "note.internal",
  "activity.view", "report.view",
];

const ASSISTANT: Permission[] = [
  "cabinet.view",
  "client.view",
  "document.view", "document.upload", "document.download",
  "request.view", "request.create",
  "task.view", "task.update",
  "deadline.view",
  "message.view",
  "activity.view",
];

/** Compte client : accès au portail, limité à son propre dossier (voir TenantScope). */
const CLIENT: Permission[] = [
  "portal.access",
  "document.view", "document.upload", "document.download",
  "request.view", "request.submit",
  "deadline.view",
  "invoice.view",
  "message.view", "message.send",
];

export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  owner: ALL,
  admin: ALL.filter((p) => p !== "cabinet.delete"),
  accountant: ACCOUNTANT,
  assistant: ASSISTANT,
  client: CLIENT,
};

export function can(role: Role, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}

/** Un rôle interne au cabinet (par opposition au compte client du portail). */
export function isStaffRole(role: Role): boolean {
  return role !== "client";
}
