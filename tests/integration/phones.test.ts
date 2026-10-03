import { beforeAll, describe, expect, it } from "vitest";
import type { AuthContext } from "@/lib/authz/guard";
import { can } from "@/lib/authz/permissions";
import { tenantDb } from "@/lib/db/tenant";
import { createClient, listClients, updateClient } from "@/server/services/clients";
import { makeCabinet, makeUser } from "../factories";

/**
 * Numéros de téléphone d'un dossier.
 *
 * Un client en a plusieurs : le gérant, la comptabilité, l'atelier. La colonne
 * `phone` reste la projection du premier — c'est elle que lisent les listes —
 * et la recherche doit retrouver le dossier par n'importe lequel des numéros,
 * pas seulement par celui qui remonte en tête.
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
  kind: "company" as const,
  subtype: "sarl" as const,
  vatRegime: "quarterly",
  taxRegime: "is",
  takeoverDate: "2026-01-01",
};

describe("numéros d'un dossier", () => {
  let ctx: AuthContext;

  beforeAll(async () => {
    const [cabinet, user] = await Promise.all([makeCabinet("Téléphones"), makeUser()]);
    ctx = contextFor(cabinet.id, user.id);
  });

  it("garde la liste et reflète le premier numéro dans la colonne plate", async () => {
    const created = await createClient(ctx, {
      ...BASE,
      legalName: "Atlas Pièces SARL",
      phones: [
        { value: "0612345678", label: "Gérant" },
        { value: "0535112233", label: "Comptabilité" },
      ],
    });

    expect(JSON.parse(created.phones)).toEqual([
      { value: "0612345678", label: "Gérant" },
      { value: "0535112233", label: "Comptabilité" },
    ]);
    expect(created.phone).toBe("0612345678");
  });

  it("retrouve le dossier par un numéro secondaire", async () => {
    await createClient(ctx, {
      ...BASE,
      legalName: "Menuiserie Chaouia SARL",
      phones: [
        { value: "0600000001", label: "Gérant" },
        { value: "0677889900", label: "Atelier" },
      ],
    });

    const trouve = await listClients(ctx, { q: "0677889900" });
    expect(trouve.items.map((row) => row.legalName)).toContain("Menuiserie Chaouia SARL");
  });

  it("suit le nouvel ordre quand le premier numéro change", async () => {
    const created = await createClient(ctx, {
      ...BASE,
      legalName: "Transport Souss SARL",
      phones: [{ value: "0611111111" }],
    });

    const modifie = await updateClient(ctx, created.id, {
      phones: [{ value: "0622222222", label: "Direction" }, { value: "0611111111" }],
    });
    expect(modifie.phone).toBe("0622222222");
  });

  it("vide la colonne quand tous les numéros sont retirés", async () => {
    const created = await createClient(ctx, {
      ...BASE,
      legalName: "Café Zitoune SARL",
      phones: [{ value: "0633333333" }],
    });

    const modifie = await updateClient(ctx, created.id, { phones: [] });
    expect(modifie.phone).toBe("");
    expect(JSON.parse(modifie.phones)).toEqual([]);
  });
});
