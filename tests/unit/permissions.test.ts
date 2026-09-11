import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { ROLES, type Role } from "@/lib/domain/enums";
import {
  ADJUSTABLE_ROLES,
  ALWAYS_GRANTED,
  GRANTABLE,
  PERMISSIONS,
  PERMISSION_GROUPS,
  REQUIRES,
  ROLE_PERMISSIONS,
  can,
  dependentsOf,
  effectivePermissions,
  isStaffRole,
  normalizePermissions,
  presetPermissions,
  readGranted,
  requirementsOf,
  storedPermissions,
  type Permission,
} from "@/lib/authz/permissions";

/**
 * Tests de la matrice RBAC.
 *
 * Le refus est la valeur par défaut : une permission absente de la table est refusée,
 * y compris pour le propriétaire. On vérifie surtout les frontières sensibles —
 * suppression du cabinet, facturation, journal d'audit, notes internes.
 */

describe("matrice des rôles", () => {
  it("chaque rôle connu possède une entrée", () => {
    for (const role of ROLES) {
      expect(Array.isArray(ROLE_PERMISSIONS[role])).toBe(true);
    }
  });

  it("aucun rôle ne détient une permission hors de la liste fermée", () => {
    const connues = new Set<string>(PERMISSIONS);
    for (const role of ROLES) {
      for (const permission of ROLE_PERMISSIONS[role]) {
        expect(connues.has(permission)).toBe(true);
      }
    }
  });

  it("aucun rôle ne contient de doublon", () => {
    for (const role of ROLES) {
      const liste = ROLE_PERMISSIONS[role];
      expect(new Set(liste).size).toBe(liste.length);
    }
  });
});

describe("propriétaire", () => {
  it("détient toutes les permissions", () => {
    for (const permission of PERMISSIONS) {
      expect(can("owner", permission)).toBe(true);
    }
    expect(ROLE_PERMISSIONS.owner).toHaveLength(PERMISSIONS.length);
  });

  it("est le seul à pouvoir supprimer le cabinet", () => {
    const autorises = ROLES.filter((role) => can(role, "cabinet.delete"));
    expect(autorises).toEqual(["owner"]);
  });
});

describe("administrateur", () => {
  it("détient toutes les permissions sauf la suppression du cabinet", () => {
    for (const permission of PERMISSIONS) {
      expect(can("admin", permission)).toBe(permission !== "cabinet.delete");
    }
  });

  it("gère les membres et la facturation", () => {
    expect(can("admin", "member.manage")).toBe(true);
    expect(can("admin", "member.invite")).toBe(true);
    expect(can("admin", "billing.manage")).toBe(true);
    expect(can("admin", "audit.view")).toBe(true);
  });
});

describe("comptable", () => {
  it("gère les dossiers, les documents et les échéances", () => {
    for (const permission of [
      "client.view",
      "client.create",
      "client.update",
      "document.approve",
      "document.delete",
      "deadline.generate",
      "note.internal",
      "invoice.view",
    ] as Permission[]) {
      expect(can("accountant", permission)).toBe(true);
    }
  });

  it("n'ouvre pas la section Équipe", () => {
    // La section porte l'invitation, les rôles et l'historique d'un
    // collaborateur : elle relève de l'administration. Savoir qui compose son
    // cabinet n'en dépend pas (voir `listStaffOptions`).
    expect(can("accountant", "member.manage")).toBe(false);
    expect(can("accountant", "member.invite")).toBe(false);
    expect(can("accountant", "member.view")).toBe(false);
  });

  it("ne voit pas le résultat du cabinet", () => {
    // Ce que gagne le cabinet ne regarde pas ses collaborateurs.
    expect(can("accountant", "finance.view")).toBe(false);
    expect(can("assistant", "finance.view")).toBe(false);
    expect(can("owner", "finance.view")).toBe(true);
    expect(can("admin", "finance.manage")).toBe(true);
  });

  it("tient sa propre liste de tâches sans distribuer celle des autres", () => {
    expect(can("accountant", "todo.view")).toBe(true);
    expect(can("accountant", "todo.manage")).toBe(false);
    expect(can("assistant", "todo.view")).toBe(true);
    expect(can("assistant", "todo.manage")).toBe(false);
    expect(can("owner", "todo.manage")).toBe(true);
    expect(can("admin", "todo.manage")).toBe(true);
    // Un compte client n'a rien à faire dans la to-do de l'équipe.
    expect(can("client", "todo.view")).toBe(false);
  });

  it("ne gère pas la facturation du cabinet", () => {
    expect(can("accountant", "billing.view")).toBe(false);
    expect(can("accountant", "billing.manage")).toBe(false);
    expect(can("accountant", "invoice.manage")).toBe(false);
  });

  it("ne consulte pas le journal d'audit", () => {
    expect(can("accountant", "audit.view")).toBe(false);
    expect(can("accountant", "activity.view")).toBe(true);
  });

  it("ne supprime ni le cabinet ni les dossiers", () => {
    expect(can("accountant", "cabinet.delete")).toBe(false);
    expect(can("accountant", "cabinet.manage")).toBe(false);
    expect(can("accountant", "client.delete")).toBe(false);
  });
});

describe("assistant", () => {
  it("consulte et dépose des documents", () => {
    expect(can("assistant", "document.view")).toBe(true);
    expect(can("assistant", "document.upload")).toBe(true);
    expect(can("assistant", "document.download")).toBe(true);
  });

  it("ne supprime ni ne valide les documents", () => {
    expect(can("assistant", "document.delete")).toBe(false);
    expect(can("assistant", "document.approve")).toBe(false);
  });

  it("ne voit pas les factures", () => {
    expect(can("assistant", "invoice.view")).toBe(false);
    expect(can("assistant", "invoice.manage")).toBe(false);
  });

  it("n'écrit pas de note interne et n'envoie pas de message", () => {
    expect(can("assistant", "note.internal")).toBe(false);
    expect(can("assistant", "message.send")).toBe(false);
    expect(can("assistant", "message.view")).toBe(true);
  });

  it("ne crée ni ne modifie les dossiers et les échéances", () => {
    expect(can("assistant", "client.create")).toBe(false);
    expect(can("assistant", "client.update")).toBe(false);
    expect(can("assistant", "deadline.create")).toBe(false);
    expect(can("assistant", "deadline.generate")).toBe(false);
    expect(can("assistant", "deadline.view")).toBe(true);
  });

  it("ne voit ni les membres ni le journal d'audit", () => {
    expect(can("assistant", "member.view")).toBe(false);
    expect(can("assistant", "audit.view")).toBe(false);
  });
});

describe("compte client du portail", () => {
  it("accède au portail", () => {
    expect(can("client", "portal.access")).toBe(true);
    const autresRoles = ROLES.filter((role) => role !== "client");
    for (const role of autresRoles) {
      // Le portail est réservé au compte client ; le personnel du cabinet n'y accède pas.
      expect(can(role, "portal.access")).toBe(role === "owner" || role === "admin");
    }
  });

  it("dépose ses pièces et suit ses échéances", () => {
    expect(can("client", "document.upload")).toBe(true);
    expect(can("client", "document.download")).toBe(true);
    expect(can("client", "deadline.view")).toBe(true);
    expect(can("client", "invoice.view")).toBe(true);
    expect(can("client", "request.submit")).toBe(true);
    expect(can("client", "message.send")).toBe(true);
  });

  it("ne voit pas les notes internes du cabinet", () => {
    expect(can("client", "note.internal")).toBe(false);
  });

  it("ne voit pas les autres dossiers, ni les membres, ni l'audit", () => {
    expect(can("client", "client.view")).toBe(false);
    expect(can("client", "member.view")).toBe(false);
    expect(can("client", "audit.view")).toBe(false);
    expect(can("client", "activity.view")).toBe(false);
    expect(can("client", "cabinet.view")).toBe(false);
  });

  it("ne supprime ni ne valide quoi que ce soit", () => {
    expect(can("client", "document.delete")).toBe(false);
    expect(can("client", "document.approve")).toBe(false);
    expect(can("client", "request.review")).toBe(false);
    expect(can("client", "client.delete")).toBe(false);
  });
});

describe("can", () => {
  it("refuse une permission inconnue quel que soit le rôle", () => {
    const inconnue = "cabinet.tout_casser" as Permission;
    for (const role of ROLES) {
      expect(can(role, inconnue)).toBe(false);
    }
    expect(can("owner", "" as Permission)).toBe(false);
    expect(can("owner", "__proto__" as Permission)).toBe(false);
  });

  it("refuse un rôle inconnu", () => {
    expect(can("superadmin" as Role, "cabinet.view")).toBe(false);
    expect(can("" as Role, "cabinet.view")).toBe(false);
  });
});

describe("isStaffRole", () => {
  it("n'est faux que pour le compte client", () => {
    expect(isStaffRole("owner")).toBe(true);
    expect(isStaffRole("admin")).toBe(true);
    expect(isStaffRole("accountant")).toBe(true);
    expect(isStaffRole("assistant")).toBe(true);
    expect(isStaffRole("custom")).toBe(true);
    expect(isStaffRole("client")).toBe(false);
    expect(ROLES.filter((role) => !isStaffRole(role))).toEqual(["client"]);
  });
});

/** Fichiers source hors de la matrice elle-même. */
function sourceFiles(dir = join(process.cwd(), "src")): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    if (!/\.tsx?$/.test(entry) || path.endsWith(join("authz", "permissions.ts"))) return [];
    return [path];
  });
}

describe("grille des droits", () => {
  const sources = sourceFiles().map((path) => readFileSync(path, "utf8"));
  const corpus = sources.join("\n");

  it("chaque case de la grille est vérifiée quelque part dans le code", () => {
    // Une case sans effet ferait croire à un retrait d'accès qui n'a pas eu lieu.
    const mortes = GRANTABLE.filter((permission) => !corpus.includes(`"${permission}"`));
    expect(mortes).toEqual([]);
  });

  it("tout droit vérifié par le code a sa case", () => {
    const pattern =
      /(?:can|requireStaff|requirePermission)\(\s*"([a-z]+\.[a-z_]+)"|permission: "([a-z]+\.[a-z_]+)"/g;
    const verifies = new Set<string>();
    for (const match of corpus.matchAll(pattern)) verifies.add(match[1] ?? match[2] ?? "");
    const horsGrille = [...verifies].filter(
      (permission) => !GRANTABLE.includes(permission as Permission) && permission !== "portal.access",
    );
    expect(horsGrille).toEqual([]);
  });

  it("ne propose ni la suppression du cabinet, ni les droits du portail client", () => {
    expect(GRANTABLE).not.toContain("cabinet.delete");
    expect(GRANTABLE).not.toContain("portal.access");
    expect(GRANTABLE).not.toContain("request.submit");
  });

  it("ne liste aucun droit deux fois", () => {
    expect(new Set(GRANTABLE).size).toBe(GRANTABLE.length);
    for (const group of PERMISSION_GROUPS) expect(group.items.length).toBeGreaterThan(0);
  });

  it("les dépendances restent dans la grille et ne bouclent pas", () => {
    for (const [permission, required] of Object.entries(REQUIRES)) {
      expect(GRANTABLE).toContain(permission);
      for (const item of required ?? []) expect(GRANTABLE).toContain(item);
      expect(requirementsOf(permission as Permission)).not.toContain(permission);
    }
  });

  it("les modèles de rôle respectent déjà les dépendances", () => {
    // Sinon un rôle non ajusté aurait des droits qu'on ne pourrait pas recocher tels quels.
    for (const role of ADJUSTABLE_ROLES) {
      const cochables = ROLE_PERMISSIONS[role].filter((p) => GRANTABLE.includes(p));
      expect(presetPermissions(role)).toEqual(GRANTABLE.filter((p) => cochables.includes(p)));
    }
  });
});

describe("normalisation d'une sélection", () => {
  it("écarte l'inconnu et le non cochable, ajoute ce qui est supposé", () => {
    const result = normalizePermissions(["document.approve", "cabinet.delete", "portal.access", "x.y"]);
    expect(result).toEqual(["cabinet.view", "document.view", "document.approve"]);
  });

  it("accorde toujours l'accès au tableau de bord", () => {
    expect(normalizePermissions([])).toEqual(ALWAYS_GRANTED);
  });

  it("décocher un droit décoche ce qui en dépend, même indirectement", () => {
    const dependants = dependentsOf("client.view");
    expect(dependants).toContain("client.update");
    expect(dependants).toContain("request.create");
    expect(dependants).toContain("intervention.manage");
    expect(dependants).not.toContain("document.view");
  });
});

describe("droits effectifs", () => {
  it("un rôle non ajusté garde ceux de son modèle", () => {
    expect(effectivePermissions("accountant", null)).toEqual(new Set(ROLE_PERMISSIONS.accountant));
  });

  it("un rôle ajusté n'a que ce qui a été coché", () => {
    const droits = effectivePermissions("accountant", ["document.view"]);
    expect([...droits]).toEqual(["cabinet.view", "document.view"]);
    expect(droits.has("client.view")).toBe(false);
  });

  it("une colonne forgée ne fait pas entrer un droit hors grille", () => {
    expect(effectivePermissions("custom", ["cabinet.delete", "portal.access"]).has("cabinet.delete")).toBe(false);
  });

  it("le propriétaire et le compte client ignorent la colonne", () => {
    expect(effectivePermissions("owner", ["document.view"]).has("cabinet.delete")).toBe(true);
    expect(effectivePermissions("client", ["member.manage"]).has("member.manage")).toBe(false);
  });

  it("une colonne illisible vaut « non ajusté »", () => {
    expect(readGranted("pas du json")).toBeNull();
    expect(readGranted('{"a":1}')).toBeNull();
    expect(readGranted(null)).toBeNull();
    expect(readGranted('["document.view", 3]')).toEqual(["document.view"]);
  });
});

describe("enregistrement des droits", () => {
  it("n'enregistre rien quand la sélection est celle du modèle", () => {
    expect(storedPermissions("accountant", presetPermissions("accountant"))).toBeNull();
    expect(storedPermissions("admin", GRANTABLE)).toBeNull();
  });

  it("enregistre un modèle ajusté", () => {
    const sansSuppression = presetPermissions("accountant").filter((p) => p !== "document.delete");
    expect(readGranted(storedPermissions("accountant", sansSuppression))).toEqual(sansSuppression);
  });

  it("enregistre toujours un rôle « Autre », même réduit au minimum", () => {
    expect(storedPermissions("custom", [])).toBe(JSON.stringify(ALWAYS_GRANTED));
  });
});
