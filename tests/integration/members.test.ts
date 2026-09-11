import { beforeAll, describe, expect, it } from "vitest";
import type { AuthContext } from "@/lib/authz/guard";
import { effectivePermissions, presetPermissions, readGranted } from "@/lib/authz/permissions";
import { platformDb, tenantDb } from "@/lib/db/tenant";
import type { Role } from "@/lib/domain/enums";
import { ForbiddenError } from "@/lib/errors";
import { addMember, listMembers, removeMember, updateMember } from "@/server/services/members";
import { makeCabinet, makeMembership, makeUser } from "../factories";

/**
 * Rôles et droits de l'équipe.
 *
 * L'enjeu n'est pas l'écran mais les garde-fous : un rôle « Autre » n'a que ce
 * qu'on lui coche, on n'accorde pas ce qu'on n'a pas, et l'on ne touche pas à
 * qui en a plus que soi.
 */
function contextFor(
  cabinetId: string,
  userId: string,
  role: Role,
  granted: string[] | null = null,
): AuthContext {
  const scope = { cabinetId, clientIds: null };
  const effective = effectivePermissions(role, granted);
  return {
    sessionId: "test",
    user: { id: userId, email: `${userId}@directconseil.ma`, name: "Test", locale: "fr" },
    cabinet: { id: cabinetId, name: "Cabinet", slug: "c", cndpMode: "declaration" },
    membership: { id: "m", role, restrictedToAssigned: false, clientId: null },
    scope,
    db: tenantDb(scope),
    ip: null,
    userAgent: "vitest",
    can: (p) => effective.has(p),
  };
}

const PASSWORD = "Registre-Tribunal-2026!";
const email = () => `droits-${Math.random().toString(36).slice(2, 10)}@exemple.ma`;

describe("rôles et droits de l'équipe", () => {
  let cabinetId: string;
  let owner: AuthContext;

  beforeAll(async () => {
    const cabinet = await makeCabinet("Droits");
    cabinetId = cabinet.id;
    const user = await makeUser();
    await makeMembership({ userId: user.id, cabinetId, role: "owner" });
    owner = contextFor(cabinetId, user.id, "owner");
  });

  async function membershipOf(userId: string) {
    return platformDb.membership.findFirstOrThrow({ where: { cabinetId, userId } });
  }

  it("crée un rôle « Autre » nommé, avec les droits cochés et ce qu'ils supposent", async () => {
    const { user } = await addMember(owner, {
      name: "Salma Berrada",
      email: email(),
      password: PASSWORD,
      role: "custom",
      roleLabel: "Secrétaire",
      permissions: ["appointment.manage"],
    });

    const membership = await membershipOf(user.id);
    expect(membership.role).toBe("custom");
    expect(membership.roleLabel).toBe("Secrétaire");
    expect(readGranted(membership.permissions)).toEqual([
      "cabinet.view",
      "appointment.view",
      "appointment.manage",
    ]);
  });

  it("refuse un rôle « Autre » sans nom ou sans aucun droit", async () => {
    await expect(
      addMember(owner, {
        name: "Sans Nom",
        email: email(),
        password: PASSWORD,
        role: "custom",
        permissions: ["task.view"],
      }),
    ).rejects.toThrow();
    await expect(
      addMember(owner, {
        name: "Sans Droit",
        email: email(),
        password: PASSWORD,
        role: "custom",
        roleLabel: "Vide",
        permissions: [],
      }),
    ).rejects.toThrow();
  });

  it("n'enregistre rien pour un modèle laissé tel quel", async () => {
    const { user } = await addMember(owner, {
      name: "Karim Alaoui",
      email: email(),
      password: PASSWORD,
      role: "accountant",
      permissions: presetPermissions("accountant"),
    });
    expect((await membershipOf(user.id)).permissions).toBeNull();
  });

  it("n'accorde pas un droit qu'on ne détient pas", async () => {
    const recruiter = await makeUser();
    await makeMembership({ userId: recruiter.id, cabinetId, role: "custom" });
    const ctx = contextFor(cabinetId, recruiter.id, "custom", [
      "member.view",
      "member.invite",
      "client.view",
    ]);

    await expect(
      addMember(ctx, {
        name: "Stagiaire Un",
        email: email(),
        password: PASSWORD,
        role: "custom",
        roleLabel: "Stagiaire",
        permissions: ["document.delete"],
      }),
    ).rejects.toBeInstanceOf(ForbiddenError);
    // Un modèle entier non plus : l'administrateur détient tout.
    await expect(
      addMember(ctx, { name: "Admin Deux", email: email(), password: PASSWORD, role: "admin" }),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("ne touche pas à qui détient plus que soi", async () => {
    const manager = await makeUser();
    await makeMembership({ userId: manager.id, cabinetId, role: "custom" });
    const ctx = contextFor(cabinetId, manager.id, "custom", [
      "member.view",
      "member.manage",
      "client.view",
    ]);
    const target = await makeUser();
    const targetMembership = await makeMembership({
      userId: target.id,
      cabinetId,
      role: "accountant",
    });

    await expect(
      updateMember(ctx, targetMembership.id, {
        role: "custom",
        roleLabel: "Rétrogradé",
        permissions: ["client.view"],
      }),
    ).rejects.toBeInstanceOf(ForbiddenError);
    await expect(removeMember(ctx, targetMembership.id)).rejects.toBeInstanceOf(ForbiddenError);
    expect((await membershipOf(target.id)).status).toBe("active");
  });

  it("ajuste un comptable et journalise les droits accordés et retirés", async () => {
    const user = await makeUser();
    const membership = await makeMembership({ userId: user.id, cabinetId, role: "accountant" });
    const selection = presetPermissions("accountant")
      .filter((permission) => permission !== "document.delete")
      .concat("todo.manage");

    await updateMember(owner, membership.id, { role: "accountant", permissions: selection });

    const after = await membershipOf(user.id);
    const effective = effectivePermissions("accountant", readGranted(after.permissions));
    expect(effective.has("document.delete")).toBe(false);
    expect(effective.has("todo.manage")).toBe(true);

    const log = await platformDb.auditLog.findFirstOrThrow({
      where: { action: "member.updated", resourceId: membership.id },
    });
    const metadata = JSON.parse(log.metadata ?? "{}") as { granted: string[]; revoked: string[] };
    expect(metadata.granted).toEqual(["todo.manage"]);
    expect(metadata.revoked).toEqual(["document.delete"]);

    const listed = (await listMembers(owner)).find((row) => row.membershipId === membership.id);
    expect(listed?.adjusted).toBe(true);
    expect(listed?.permissions).not.toContain("document.delete");
  });

  it("revenir au modèle efface l'ajustement", async () => {
    const user = await makeUser();
    const membership = await makeMembership({ userId: user.id, cabinetId, role: "assistant" });
    await updateMember(owner, membership.id, { role: "assistant", permissions: ["task.view"] });
    expect((await membershipOf(user.id)).permissions).not.toBeNull();

    await updateMember(owner, membership.id, {
      role: "assistant",
      permissions: presetPermissions("assistant"),
    });
    expect((await membershipOf(user.id)).permissions).toBeNull();
  });
});
