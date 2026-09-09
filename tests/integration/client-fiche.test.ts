import { beforeAll, describe, expect, it } from "vitest";
import type { AuthContext } from "@/lib/authz/guard";
import { can } from "@/lib/authz/permissions";
import { tenantDb } from "@/lib/db/tenant";
import { createClient, updateClient } from "@/server/services/clients";
import { makeCabinet, makeUser } from "../factories";

/**
 * La fiche client est scindée : personne physique et personne morale ne portent
 * pas les mêmes pièces. Ces essais couvrent ce que l'écran seul ne garantit pas —
 * la cohérence type / forme, la sérialisation des listes, et le fait que les CIN
 * des associés obéissent au même mode CNDP que celle du gérant.
 */
function contextFor(
  cabinetId: string,
  userId: string,
  cndpMode: "declaration" | "authorization",
): AuthContext {
  const scope = { cabinetId, clientIds: null };
  return {
    sessionId: "test",
    user: { id: userId, email: "t@directconseil.ma", name: "Test", locale: "fr" },
    cabinet: { id: cabinetId, name: "Cabinet", slug: "c", cndpMode },
    membership: { id: "m", role: "owner", restrictedToAssigned: false, clientId: null },
    scope,
    db: tenantDb(scope),
    ip: null,
    userAgent: "vitest",
    can: (p) => can("owner", p),
  };
}

const BASE = {
  legalName: "Dossier d'essai",
  vatRegime: "quarterly",
  taxRegime: "is",
  takeoverDate: "2026-01-01",
};

describe("fiche client scindée", () => {
  let declaring: AuthContext;
  let authorized: AuthContext;

  beforeAll(async () => {
    const [cabinetA, cabinetB, user] = await Promise.all([
      makeCabinet("Fiche declaration"),
      makeCabinet("Fiche autorisation"),
      makeUser(),
    ]);
    declaring = contextFor(cabinetA.id, user.id, "declaration");
    authorized = contextFor(cabinetB.id, user.id, "authorization");
  });

  it("refuse une forme de société sur une personne physique", async () => {
    await expect(
      createClient(declaring, { ...BASE, kind: "individual", subtype: "sarl" }),
    ).rejects.toThrow();
  });

  it("refuse une forme de personne physique sur une société", async () => {
    await expect(
      createClient(declaring, { ...BASE, kind: "company", subtype: "cpu" }),
    ).rejects.toThrow();
  });

  it("enregistre les listes en JSON et reflète le premier élément", async () => {
    const created = await createClient(declaring, {
      ...BASE,
      kind: "individual",
      subtype: "rnr",
      legalName: "Kamal Ouazzani",
      taxDistrict: "Fès-Ville nouvelle",
      cnssRegNo: "123456789",
      activities: ["Conseil", "Formation"],
    });

    expect(JSON.parse(created.declaredActivities)).toEqual(["Conseil", "Formation"]);
    expect(created.activity).toBe("Conseil");
    expect(created.taxDistrict).toBe("Fès-Ville nouvelle");
  });

  it("aplatit l'arbre des immatriculations pour la recherche et l'affichage", async () => {
    const created = await createClient(declaring, {
      ...BASE,
      kind: "individual",
      subtype: "rnr",
      legalName: "Immatriculations imbriquées",
      registrations: [
        {
          number: "RC-100",
          court: "Fès",
          taxProfNos: [{ value: "TP-PRINCIPAL" }],
          branches: [
            { number: "SUC-9", court: "Fès", taxProfNos: [{ value: "TP-A" }, { value: "TP-B" }] },
            { number: "SUC-10", court: "Fès", taxProfNos: [] },
          ],
        },
        { number: "RC-200", court: "Meknès", taxProfNos: [], branches: [] },
      ],
    });

    // L'arbre est la source ; le reste en est déduit à l'écriture.
    const tree = JSON.parse(created.registrations) as {
      id: string;
      branches: { id: string; taxProfNos: { id: string }[] }[];
      taxProfNos: { id: string }[];
    }[];
    expect(tree).toHaveLength(2);
    expect(tree[0]?.branches).toHaveLength(2);

    // Chaque ligne reçoit un identifiant stable, distinct : c'est lui qui porte
    // le justificatif, un indice de position se décalant au moindre retrait.
    const ids = [
      ...tree.map((r) => r.id),
      ...tree.flatMap((r) => r.taxProfNos.map((t) => t.id)),
      ...tree.flatMap((r) => r.branches.map((b) => b.id)),
      ...tree.flatMap((r) => r.branches.flatMap((b) => b.taxProfNos.map((t) => t.id))),
    ];
    expect(ids.every(Boolean)).toBe(true);
    expect(new Set(ids).size).toBe(ids.length);

    expect(created.rc).toBe("RC-100");
    expect(created.rcCourt).toBe("Fès");
    expect(JSON.parse(created.branches)).toEqual([
      { number: "SUC-9", court: "Fès" },
      { number: "SUC-10", court: "Fès" },
    ]);
    expect(JSON.parse(created.taxProfNos)).toEqual(["TP-PRINCIPAL", "TP-A", "TP-B"]);
    expect(created.taxProfNo).toBe("TP-PRINCIPAL");
  });

  it("refuse une immatriculation sans numéro", async () => {
    await expect(
      createClient(declaring, {
        ...BASE,
        kind: "company",
        subtype: "sarl",
        registrations: [{ number: "", court: "Fès" }],
      }),
    ).rejects.toThrow();
  });

  it("déduit le nombre de salariés dès qu'ils sont nommés", async () => {
    const created = await createClient(declaring, {
      ...BASE,
      kind: "company",
      subtype: "sarl",
      employeeCount: 99,
      employees: [
        { name: "Salma Idrissi", cnssNo: "123456789" },
        { name: "Youssef Tazi" },
      ],
    });

    expect(created.employeeCount).toBe(2);
    expect(JSON.parse(created.employees)).toHaveLength(2);
  });

  it("refuse la CIN d'un salarié en mode déclaration", async () => {
    await expect(
      createClient(declaring, {
        ...BASE,
        kind: "company",
        subtype: "sarl",
        employees: [{ name: "Salma Idrissi", cin: "BK998877" }],
      }),
    ).rejects.toThrow(/déclaration/);
  });

  it("refuse une immatriculation CNSS qui n'a pas neuf chiffres", async () => {
    await expect(
      createClient(declaring, { ...BASE, kind: "individual", subtype: "rnr", cnssRegNo: "1234" }),
    ).rejects.toThrow();
  });

  it("refuse la CIN d'un associé en mode déclaration", async () => {
    await expect(
      createClient(declaring, {
        ...BASE,
        kind: "company",
        subtype: "sarl",
        partners: [{ role: "gerant", name: "Nadia Alaoui", cin: "BK123456" }],
      }),
    ).rejects.toThrow(/déclaration/);
  });

  it("conserve la CIN d'un associé en mode autorisation", async () => {
    const created = await createClient(authorized, {
      ...BASE,
      kind: "company",
      subtype: "sarl",
      partners: [
        { role: "gerant", name: "Nadia Alaoui", cin: "BK123456" },
        { role: "associe", name: "Omar Bennani" },
      ],
    });

    const partners = JSON.parse(created.partners) as { name: string; cin?: string }[];
    expect(partners).toHaveLength(2);
    expect(partners[0]?.cin).toBe("BK123456");
    expect(partners[1]?.cin).toBeUndefined();
  });

  it("remplace la liste entière à la modification", async () => {
    const created = await createClient(authorized, {
      ...BASE,
      kind: "company",
      subtype: "sarl",
      activities: ["Négoce", "Import"],
    });

    const updated = await updateClient(authorized, created.id, {
      kind: "company",
      subtype: "sarl",
      activities: ["Négoce"],
    });

    expect(JSON.parse(updated.declaredActivities)).toEqual(["Négoce"]);
    expect(updated.activity).toBe("Négoce");
  });

  it("laisse les listes intactes quand elles ne sont pas envoyées", async () => {
    const created = await createClient(authorized, {
      ...BASE,
      kind: "company",
      subtype: "sarl",
      registrations: [{ number: "RC-7", court: "Rabat", taxProfNos: [{ value: "TP-7" }] }],
    });

    const updated = await updateClient(authorized, created.id, { city: "Agadir" });

    expect(JSON.parse(updated.taxProfNos)).toEqual(["TP-7"]);
    expect(updated.rc).toBe("RC-7");
    expect(updated.city).toBe("Agadir");
  });


  it("réémet un identifiant de ligne dupliqué", async () => {
    const created = await createClient(declaring, {
      ...BASE,
      kind: "company",
      subtype: "sarl",
      legalName: "Identifiants dupliqués",
      registrations: [
        { id: "aaaabbbb", number: "RC-1", taxProfNos: [] },
        { id: "aaaabbbb", number: "RC-2", taxProfNos: [] },
      ],
    });

    const tree = JSON.parse(created.registrations) as { id: string }[];
    expect(tree[0]?.id).toBe("aaaabbbb");
    expect(tree[1]?.id).not.toBe("aaaabbbb");
  });

  it("accepte une forme libre pour une personne physique", async () => {
    const created = await createClient(declaring, {
      ...BASE,
      kind: "individual",
      subtype: "autre",
      subtypeOther: "Coopérative agricole familiale",
      legalName: "Forme hors liste",
    });

    expect(created.subtype).toBe("autre");
    expect(created.subtypeOther).toBe("Coopérative agricole familiale");
  });

  it("enregistre les articles d'imposition avec leur usage", async () => {
    const created = await createClient(declaring, {
      ...BASE,
      kind: "individual",
      subtype: "particulier",
      taxRegime: "none",
      legalName: "Propriétaire particulier",
      articles: [
        { number: "ART-11", designation: "Appartement", address: "Casablanca", usage: "principale" },
        { number: "ART-12", designation: "Garage", address: "Casablanca", usage: "locatif" },
      ],
    });

    const articles = JSON.parse(created.articles) as { id: string; usage: string }[];
    expect(articles.map((a) => a.usage)).toEqual(["principale", "locatif"]);
    // Chaque article porte un identifiant : c'est lui qui reçoit le justificatif.
    expect(new Set(articles.map((a) => a.id)).size).toBe(2);
  });

  it("retient l'usage « habitation principale » par défaut", async () => {
    const created = await createClient(declaring, {
      ...BASE,
      kind: "individual",
      subtype: "particulier",
      legalName: "Article sans usage",
      articles: [{ number: "ART-20" }],
    });

    expect((JSON.parse(created.articles) as { usage: string }[])[0]?.usage).toBe("principale");
  });
});
