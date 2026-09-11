import { beforeAll, describe, expect, it } from "vitest";
import type { AuthContext } from "@/lib/authz/guard";
import { can } from "@/lib/authz/permissions";
import { tenantDb } from "@/lib/db/tenant";
import { createClient, updateClient } from "@/server/services/clients";
import { expectedScans } from "@/server/services/documents";
import { makeCabinet, makeUser } from "../factories";

/**
 * Établissements du registre de commerce.
 *
 * Adresse, patente et autorisation appartiennent à chaque établissement, pas au
 * dossier : l'adresse fixe le tribunal et la commune de la patente, et
 * l'autorisation d'exploiter est délivrée pour un local. Ce qui doit tenir,
 * c'est qu'aucune de ces valeurs ne se perde en passant d'une autorisation
 * unique à une autorisation par établissement.
 */
function contextFor(cabinetId: string, userId: string): AuthContext {
  const scope = { cabinetId, clientIds: null };
  return {
    sessionId: "test",
    user: { id: userId, email: "t@directconseil.ma", name: "Test", locale: "fr" },
    cabinet: { id: cabinetId, name: "Cabinet", slug: "c", cndpMode: "declaration" },
    membership: { id: "m", role: "owner", restrictedToAssigned: false, clientId: null },
    scope,
    db: tenantDb(scope),
    ip: null,
    userAgent: "vitest",
    can: (p) => can("owner", p),
  };
}

const BASE = {
  vatRegime: "quarterly",
  taxRegime: "is",
  takeoverDate: "2026-01-01",
};

type Tree = {
  address?: string;
  authorizationNo?: string;
  branches: { address?: string; authorizationNo?: string }[];
}[];

describe("établissements du registre de commerce", () => {
  let ctx: AuthContext;

  beforeAll(async () => {
    const [cabinet, user] = await Promise.all([makeCabinet("Établissements"), makeUser()]);
    ctx = contextFor(cabinet.id, user.id);
  });

  it("garde l'adresse et l'autorisation de chaque registre et de chaque succursale", async () => {
    const created = await createClient(ctx, {
      ...BASE,
      kind: "company",
      subtype: "sarl",
      legalName: "Atlas Distribution SARL",
      registrations: [
        {
          number: "RC-500",
          court: "Casablanca",
          address: "12 bd Zerktouni, Casablanca",
          authorizationNo: "AUT-CASA-1",
          taxProfNos: [{ value: "TP-CASA" }],
          branches: [
            {
              number: "SUC-1",
              court: "Casablanca",
              address: "Zone industrielle Aïn Sebaâ",
              authorizationNo: "AUT-CASA-2",
              taxProfNos: [{ value: "TP-AS" }],
            },
          ],
        },
        { number: "RC-600", court: "Tanger", address: "Zone franche, Tanger" },
      ],
    });

    const tree = JSON.parse(created.registrations) as Tree;
    expect(tree[0]?.address).toBe("12 bd Zerktouni, Casablanca");
    expect(tree[0]?.authorizationNo).toBe("AUT-CASA-1");
    expect(tree[0]?.branches[0]?.address).toBe("Zone industrielle Aïn Sebaâ");
    expect(tree[0]?.branches[0]?.authorizationNo).toBe("AUT-CASA-2");
    expect(tree[1]?.address).toBe("Zone franche, Tanger");
    expect(tree[1]?.authorizationNo).toBeUndefined();
    // La colonne reflète la première autorisation, pour la recherche et les listes.
    expect(created.authorizationNo).toBe("AUT-CASA-1");
  });

  it("reprend une autorisation portée par une succursale seulement", async () => {
    const created = await createClient(ctx, {
      ...BASE,
      kind: "company",
      subtype: "sarl_au",
      legalName: "Boulangerie du Nord SARL AU",
      registrations: [
        { number: "RC-1", branches: [{ number: "S-1", authorizationNo: "AUT-FOUR-9" }] },
      ],
    });
    expect(created.authorizationNo).toBe("AUT-FOUR-9");
  });

  it("laisse l'autorisation d'un dossier sans registre", async () => {
    const created = await createClient(ctx, {
      ...BASE,
      kind: "individual",
      subtype: "rns",
      legalName: "Nadia Tazi",
      authorizationNo: "ORDRE-778",
    });
    expect(created.authorizationNo).toBe("ORDRE-778");
  });

  it("vide la colonne quand plus aucun établissement n'a d'autorisation", async () => {
    const created = await createClient(ctx, {
      ...BASE,
      kind: "company",
      subtype: "sarl",
      legalName: "Café Andalous SARL",
      registrations: [{ number: "RC-77", authorizationNo: "AUT-77" }],
    });
    const updated = await updateClient(ctx, created.id, {
      registrations: [{ number: "RC-77", address: "Place Hassan II, Rabat" }],
    });
    expect(updated.authorizationNo).toBeNull();
  });
});

describe("pièces d'autorisation attendues", () => {
  const client = {
    kind: "company",
    authorizationNo: "AUT-1",
    registrations: JSON.stringify([
      {
        id: "r1",
        number: "RC-1",
        authorizationNo: "AUT-1",
        branches: [
          { id: "b1", number: "S-1", authorizationNo: "AUT-2" },
          { id: "b2", number: "S-2" },
        ],
      },
    ]),
  };

  it("en attend une par établissement qui déclare une autorisation", () => {
    const rows = expectedScans(client, new Map([["auth:b1", true]]));
    const keys = rows.map((row) => row.key);
    expect(keys).toContain("auth:r1");
    expect(keys).toContain("auth:b1");
    expect(keys).not.toContain("auth:b2");
    expect(keys).not.toContain("authorization");
    expect(rows.find((row) => row.key === "auth:b1")?.attached).toBe(true);
    expect(rows.find((row) => row.key === "auth:r1")?.attached).toBe(false);
  });

  it("compte l'ancienne pièce du dossier pour le premier registre", () => {
    const rows = expectedScans(client, new Map([["authorization", true]]));
    expect(rows.find((row) => row.key === "auth:r1")?.attached).toBe(true);
    expect(rows.find((row) => row.key === "auth:b1")?.attached).toBe(false);
  });

  it("garde la pièce du dossier quand il n'a pas de registre", () => {
    const rows = expectedScans({ ...client, registrations: "[]" }, new Map());
    expect(rows.map((row) => row.key)).toContain("authorization");
  });

  it("la garde aussi tant qu'aucun établissement n'a repris l'autorisation", () => {
    // Dossier saisi avant le découpage : registres présents, autorisation au dossier.
    const legacy = {
      kind: "company",
      authorizationNo: "AUT-ANCIEN",
      registrations: JSON.stringify([{ id: "r9", number: "RC-9", branches: [] }]),
    };
    const keys = expectedScans(legacy, new Map()).map((row) => row.key);
    expect(keys).toContain("authorization");
    expect(keys).not.toContain("auth:r9");
  });
});
