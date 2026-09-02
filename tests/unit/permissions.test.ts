import { describe, expect, it } from "vitest";
import { ROLES, type Role } from "@/lib/domain/enums";
import {
  PERMISSIONS,
  ROLE_PERMISSIONS,
  can,
  isStaffRole,
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

  it("ne gère pas les membres du cabinet", () => {
    expect(can("accountant", "member.manage")).toBe(false);
    expect(can("accountant", "member.invite")).toBe(false);
    expect(can("accountant", "member.view")).toBe(true);
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
    expect(isStaffRole("client")).toBe(false);
    expect(ROLES.filter((role) => !isStaffRole(role))).toEqual(["client"]);
  });
});
