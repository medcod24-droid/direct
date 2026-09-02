import bcrypt from "bcryptjs";
import { platformDb } from "@/lib/db/tenant";

let counter = 0;
const unique = () => `${Date.now().toString(36)}-${(counter += 1)}`;

export async function makeCabinet(name = "Cabinet") {
  const plan = await platformDb.plan.findUniqueOrThrow({ where: { code: "professional" } });
  const slug = `${name.toLowerCase().replace(/[^a-z]/g, "")}-${unique()}`;
  return platformDb.cabinet.create({
    data: {
      name,
      slug,
      subscription: {
        create: { planId: plan.id, status: "trialing", trialEndsAt: new Date(Date.now() + 30 * 86400000) },
      },
    },
  });
}

export async function makeUser(email?: string) {
  return platformDb.user.create({
    data: {
      email: email ?? `user-${unique()}@test.ma`,
      name: "Utilisateur test",
      passwordHash: await bcrypt.hash("MotDePasse2026!", 10),
    },
  });
}

export async function makeMembership(input: {
  userId: string;
  cabinetId: string;
  role?: string;
  restrictedToAssigned?: boolean;
  clientId?: string | null;
}) {
  return platformDb.membership.create({
    data: {
      userId: input.userId,
      cabinetId: input.cabinetId,
      role: input.role ?? "accountant",
      restrictedToAssigned: input.restrictedToAssigned ?? false,
      clientId: input.clientId ?? null,
    },
  });
}

export async function makeClient(cabinetId: string, overrides: Record<string, unknown> = {}) {
  return platformDb.client.create({
    data: {
      cabinetId,
      kind: "company",
      subtype: "sarl",
      legalName: `Client ${unique()}`,
      vatRegime: "quarterly",
      taxRegime: "is",
      isEmployer: false,
      takeoverDate: new Date("2026-01-01"),
      ...overrides,
    },
  });
}

export async function makeDocument(cabinetId: string, clientId: string) {
  return platformDb.document.create({
    data: {
      cabinetId,
      clientId,
      filename: "facture.pdf",
      storageKey: `${cabinetId}/2026/${unique()}.bin`,
      mimeType: "application/pdf",
      size: 1024,
      checksum: "a".repeat(64),
    },
  });
}
