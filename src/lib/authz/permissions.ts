import type { Role } from "@/lib/domain/enums";

/**
 * RBAC : liste fermée de permissions. Le refus est la valeur par défaut —
 * une permission absente de la table est refusée, y compris pour le propriétaire.
 *
 * `member.view` ouvre la **section Équipe** — inviter, changer un rôle, lire
 * l'historique d'un collaborateur — et reste réservée à l'administration.
 * Connaître le nom de ses collègues n'en dépend pas : les sélecteurs
 * « assigné à », « reçu par » passent par `listStaffOptions`, autorisé par la
 * permission de l'écran qui les affiche.
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
  "intervention.view", "intervention.manage",
  "appointment.view", "appointment.manage",
  "todo.view", "todo.manage",
  "finance.view", "finance.manage",
  "billing.view", "billing.manage",
  "portal.access",
] as const;

export type Permission = (typeof PERMISSIONS)[number];

const ALL: Permission[] = [...PERMISSIONS];

const ACCOUNTANT: Permission[] = [
  "cabinet.view",
  "client.view", "client.create", "client.update", "contact.manage",
  "document.view", "document.upload", "document.download", "document.delete", "document.approve",
  "request.view", "request.create", "request.review", "request.cancel",
  "task.view", "task.create", "task.update", "task.assign",
  "deadline.view", "deadline.create", "deadline.update", "deadline.generate",
  "invoice.view",
  "message.view", "message.send", "note.internal",
  "activity.view", "report.view",
  "intervention.view", "intervention.manage",
  "appointment.view", "appointment.manage",
  // Voit sa propre liste de tâches et la rend ; c'est l'administrateur qui distribue.
  "todo.view",
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
  // L'assistant lit le registre des services rendus, il ne l'écrit pas.
  "intervention.view",
  // Le planning, en revanche, il le tient : c'est souvent lui qui prend les rendez-vous.
  "appointment.view", "appointment.manage",
  "todo.view",
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
  // « Autre » ne part de rien : ses droits sont ceux que l'administration coche.
  custom: ["cabinet.view"],
  client: CLIENT,
};

export function can(role: Role, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}

/** Un rôle interne au cabinet (par opposition au compte client du portail). */
export function isStaffRole(role: Role): boolean {
  return role !== "client";
}

// --- droits ajustables ---------------------------------------------------------

/**
 * Rôles dont l'administration peut cocher les droits un à un.
 *
 * Ni le propriétaire — ses droits ne se retirent pas, ils se transmettent — ni
 * le compte client, dont le périmètre est fixé par le portail.
 */
export const ADJUSTABLE_ROLES = ["admin", "accountant", "assistant", "custom"] as const;
export type AdjustableRole = (typeof ADJUSTABLE_ROLES)[number];

export function isAdjustableRole(role: string): role is AdjustableRole {
  return (ADJUSTABLE_ROLES as readonly string[]).includes(role);
}

export type PermissionItem = {
  permission: Permission;
  label: string;
  description?: string;
  /** Droit qui touche à l'argent, aux accès ou à une suppression : signalé à l'écran. */
  sensitive?: boolean;
};

export type PermissionGroup = { key: string; title: string; items: PermissionItem[] };

/**
 * Ce que l'administration peut cocher, groupé comme la navigation.
 *
 * **N'y figure que ce que le code vérifie réellement.** Une case sans effet —
 * « Envoyer des messages » alors que la messagerie ne consulte aucun droit —
 * ferait croire à l'administration qu'elle a retiré un accès qu'elle n'a pas
 * retiré. Un test parcourt `src/` pour garantir que chaque case est lue quelque
 * part, et que tout droit vérifié quelque part a sa case.
 *
 * Hors grille, donc : `cabinet.delete` (propriétaire seul), `portal.access` et
 * `request.submit` (compte client), et les permissions déclarées pour des écrans
 * qui ne les consultent pas encore.
 */
export const PERMISSION_GROUPS: PermissionGroup[] = [
  {
    key: "cabinet",
    title: "Cabinet",
    items: [
      {
        permission: "cabinet.view",
        label: "Ouvrir le tableau de bord et les réglages",
        description: "Point d'entrée de tout collaborateur : toujours accordé.",
      },
      {
        permission: "cabinet.manage",
        label: "Modifier les réglages du cabinet",
        description: "Coordonnées du cabinet et mode CNDP, qui autorise l'enregistrement des CIN.",
        sensitive: true,
      },
    ],
  },
  {
    key: "team",
    title: "Équipe",
    items: [
      {
        permission: "member.view",
        label: "Ouvrir la section Équipe",
        description: "Liste des collaborateurs, leur fiche et l'historique de ce qu'ils ont fait.",
      },
      {
        permission: "member.invite",
        label: "Ajouter un collaborateur",
        description: "Créer un compte avec un mot de passe initial.",
        sensitive: true,
      },
      {
        permission: "member.manage",
        label: "Modifier les droits et retirer un collaborateur",
        description: "Permet de redistribuer les droits : à réserver à l'administration.",
        sensitive: true,
      },
    ],
  },
  {
    key: "clients",
    title: "Dossiers clients",
    items: [
      {
        permission: "client.view",
        label: "Consulter les dossiers",
        description: "Liste des dossiers, fiche complète et fiche imprimable.",
      },
      { permission: "client.create", label: "Créer un dossier" },
      {
        permission: "client.update",
        label: "Modifier la fiche d'un dossier",
        description: "Identité, immatriculations, succursales, associés, employés, articles…",
      },
      {
        permission: "client.assign",
        label: "Assigner les dossiers aux collaborateurs",
        description: "Décide qui suit quel dossier, ce qui fixe la portée « dossiers assignés ».",
      },
      {
        permission: "client.delete",
        label: "Archiver un dossier",
        sensitive: true,
      },
      {
        permission: "report.view",
        label: "Voir l'évaluation des dossiers",
        description: "La note en étoiles qui résume l'état de chaque dossier.",
      },
    ],
  },
  {
    key: "documents",
    title: "Documents",
    items: [
      {
        permission: "document.view",
        label: "Ouvrir la section Documents",
        description: "Toutes les pièces reçues, tous dossiers confondus.",
      },
      {
        permission: "document.upload",
        label: "Déposer des pièces",
        description: "Y compris les justificatifs joints aux champs de la fiche : CIN, RC, IF, ICE…",
      },
      { permission: "document.download", label: "Télécharger les pièces" },
      { permission: "document.approve", label: "Valider ou refuser une pièce" },
      { permission: "document.delete", label: "Supprimer une pièce", sensitive: true },
    ],
  },
  {
    key: "requests",
    title: "Demandes de pièces",
    items: [
      { permission: "request.view", label: "Consulter les demandes" },
      { permission: "request.create", label: "Demander une pièce à un client" },
      {
        permission: "request.review",
        label: "Traiter les pièces reçues",
        description: "Accepter ou refuser ce que le client dépose ; reçoit l'avis de dépôt.",
      },
    ],
  },
  {
    key: "deadlines",
    title: "Échéances fiscales",
    items: [
      { permission: "deadline.view", label: "Consulter les échéances" },
      {
        permission: "deadline.update",
        label: "Mettre à jour une échéance",
        description: "Statut, preuve de dépôt, qui dépose, panne du portail de la DGI ou de la CNSS.",
      },
      {
        permission: "deadline.generate",
        label: "Générer le calendrier de l'année",
        description: "Crée les échéances de tous les dossiers d'après leur régime.",
      },
    ],
  },
  {
    key: "tasks",
    title: "Tâches des dossiers",
    items: [
      { permission: "task.view", label: "Consulter les tâches" },
      { permission: "task.create", label: "Créer une tâche" },
      { permission: "task.update", label: "Terminer une tâche" },
    ],
  },
  {
    key: "todos",
    title: "To-do de l'équipe",
    items: [
      {
        permission: "todo.view",
        label: "Recevoir des tâches",
        description: "Voir ce qui lui est confié et le rendre à l'administration.",
      },
      {
        permission: "todo.manage",
        label: "Distribuer et confirmer les tâches",
        description: "Voit les tâches de toute l'équipe, les confie, les confirme ou les renvoie.",
      },
    ],
  },
  {
    key: "appointments",
    title: "Rendez-vous",
    items: [
      { permission: "appointment.view", label: "Consulter l'agenda" },
      {
        permission: "appointment.manage",
        label: "Prendre et valider les rendez-vous",
        description: "Créer, déplacer, annuler, valider avec un compte rendu.",
      },
    ],
  },
  {
    key: "interventions",
    title: "Liste d'activité",
    items: [
      {
        permission: "intervention.view",
        label: "Consulter la liste d'activité",
        description: "Les services rendus à chaque client, sur sa fiche.",
      },
      {
        permission: "intervention.manage",
        label: "Enregistrer un service rendu",
        description: "Ajouter, corriger ou retirer une ligne.",
      },
    ],
  },
  {
    key: "invoices",
    title: "Honoraires",
    items: [
      { permission: "invoice.view", label: "Consulter les honoraires" },
      {
        permission: "invoice.manage",
        label: "Émettre des factures et encaisser",
        sensitive: true,
      },
    ],
  },
  {
    key: "finance",
    title: "Résultat du cabinet",
    items: [
      {
        permission: "finance.view",
        label: "Voir le résultat du cabinet",
        description: "Bénéfice ou perte de chaque mois, graphique du tableau de bord compris.",
        sensitive: true,
      },
      { permission: "finance.manage", label: "Saisir le résultat mensuel", sensitive: true },
    ],
  },
];

/** Tous les droits cochables, dans l'ordre de la grille. */
export const GRANTABLE: Permission[] = PERMISSION_GROUPS.flatMap((group) =>
  group.items.map((item) => item.permission),
);

const GRANTABLE_SET = new Set<string>(GRANTABLE);

export function isGrantable(value: string): value is Permission {
  return GRANTABLE_SET.has(value);
}

/** Toujours accordé à un collaborateur : sans lui, il n'a pas de page d'accueil. */
export const ALWAYS_GRANTED: Permission[] = ["cabinet.view"];

/**
 * Ce qu'un droit suppose. Agir sans voir n'a pas de sens — valider une pièce
 * sans ouvrir la section Documents, c'est un bouton sur une page interdite.
 * Cocher un droit coche donc ce qu'il suppose, et décocher un droit décoche ce
 * qui en dépend : l'écran ne peut pas produire une combinaison incohérente.
 */
export const REQUIRES: Partial<Record<Permission, Permission[]>> = {
  "cabinet.manage": ["cabinet.view"],
  "member.invite": ["member.view"],
  "member.manage": ["member.view"],
  "client.create": ["client.view"],
  "client.update": ["client.view"],
  "client.assign": ["client.view"],
  "client.delete": ["client.view"],
  "report.view": ["client.view"],
  // Le dépôt se fait depuis la fiche du dossier.
  "document.upload": ["client.view"],
  "document.download": ["document.view"],
  "document.approve": ["document.view"],
  "document.delete": ["document.view"],
  "request.create": ["request.view", "client.view"],
  "request.review": ["request.view"],
  "deadline.update": ["deadline.view"],
  "deadline.generate": ["deadline.view"],
  "task.create": ["task.view"],
  "task.update": ["task.view"],
  "todo.manage": ["todo.view"],
  "appointment.manage": ["appointment.view"],
  // La liste d'activité s'affiche sur la fiche du dossier.
  "intervention.view": ["client.view"],
  "intervention.manage": ["intervention.view"],
  "invoice.manage": ["invoice.view"],
  "finance.manage": ["finance.view"],
};

/** Ce que `permission` suppose, directement ou non. */
export function requirementsOf(permission: Permission): Permission[] {
  const found = new Set<Permission>();
  const visit = (current: Permission) => {
    for (const required of REQUIRES[current] ?? []) {
      if (found.has(required)) continue;
      found.add(required);
      visit(required);
    }
  };
  visit(permission);
  return [...found];
}

/** Ce qui suppose `permission`, directement ou non : à décocher avec lui. */
export function dependentsOf(permission: Permission): Permission[] {
  return GRANTABLE.filter((candidate) => requirementsOf(candidate).includes(permission));
}

/**
 * Remet une sélection d'aplomb : droits inconnus ou non cochables écartés,
 * droits supposés ajoutés, ordre de la grille. C'est la seule forme enregistrée.
 */
export function normalizePermissions(values: Iterable<string>): Permission[] {
  const selected = new Set<Permission>(ALWAYS_GRANTED);
  for (const value of values) {
    if (!isGrantable(value)) continue;
    selected.add(value);
    for (const required of requirementsOf(value)) selected.add(required);
  }
  return GRANTABLE.filter((permission) => selected.has(permission));
}

/** Les cases qu'un modèle de rôle coche. */
export function presetPermissions(role: Role): Permission[] {
  return normalizePermissions(ROLE_PERMISSIONS[role] ?? []);
}

/** Lit la colonne `Membership.permissions` ; toute valeur illisible vaut « non ajusté ». */
export function readGranted(stored: string | null | undefined): string[] | null {
  if (!stored) return null;
  try {
    const parsed: unknown = JSON.parse(stored);
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : null;
  } catch {
    return null;
  }
}

/**
 * Valeur à enregistrer : nulle quand la sélection est exactement le modèle du
 * rôle, pour qu'un comptable non ajusté suive les évolutions du rôle Comptable.
 * « Autre » n'a pas de modèle : sa sélection est toujours enregistrée.
 */
export function storedPermissions(role: AdjustableRole, selection: Permission[]): string | null {
  const normalized = normalizePermissions(selection);
  if (role !== "custom" && sameSet(normalized, presetPermissions(role))) return null;
  return JSON.stringify(normalized);
}

/**
 * Droits effectifs d'une adhésion. Le propriétaire et le compte client gardent
 * ceux de leur rôle quoi qu'enregistre la colonne.
 */
export function effectivePermissions(role: Role, granted: readonly string[] | null): ReadonlySet<Permission> {
  if (granted === null || !isAdjustableRole(role)) return new Set(ROLE_PERMISSIONS[role] ?? []);
  return new Set(normalizePermissions(granted));
}

/** Libellé d'un droit, pour les messages d'erreur et le journal. */
export function permissionLabel(permission: Permission): string {
  for (const group of PERMISSION_GROUPS) {
    const item = group.items.find((candidate) => candidate.permission === permission);
    if (item) return item.label;
  }
  return permission;
}

function sameSet(a: readonly string[], b: readonly string[]): boolean {
  if (a.length !== b.length) return false;
  const set = new Set(a);
  return b.every((item) => set.has(item));
}
