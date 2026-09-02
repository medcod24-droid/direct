import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { platformDb } from "@/lib/db/tenant";
import { env } from "@/lib/env";

export const SESSION_COOKIE = "dc_session";
const SESSION_TTL_MS = 1000 * 60 * 60 * 12; // 12 h
const ABSOLUTE_MAX_MS = 1000 * 60 * 60 * 24 * 30;

/** Le jeton en clair ne quitte jamais le cookie ; la base ne stocke que son SHA-256. */
export function hashToken(token: string): string {
  return createHash("sha256").update(token + env().APP_SECRET).digest("hex");
}

export function newToken(): string {
  return randomBytes(32).toString("base64url");
}

export async function createSession(input: {
  userId: string;
  cabinetId?: string | null;
  ip?: string | null;
  userAgent?: string | null;
}) {
  const token = newToken();
  const session = await platformDb.session.create({
    data: {
      tokenHash: hashToken(token),
      userId: input.userId,
      cabinetId: input.cabinetId ?? null,
      expiresAt: new Date(Date.now() + SESSION_TTL_MS),
      ip: input.ip ?? null,
      userAgent: input.userAgent?.slice(0, 300) ?? null,
    },
  });
  return { token, session };
}

export async function readSession(token: string | undefined | null) {
  if (!token) return null;
  const session = await platformDb.session.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { user: true },
  });
  if (!session) return null;
  if (session.expiresAt.getTime() < Date.now()) {
    await platformDb.session.delete({ where: { id: session.id } }).catch(() => undefined);
    return null;
  }
  if (Date.now() - session.createdAt.getTime() > ABSOLUTE_MAX_MS) {
    await platformDb.session.delete({ where: { id: session.id } }).catch(() => undefined);
    return null;
  }
  if (!session.user.isActive) return null;
  return session;
}

export async function destroySession(token: string | undefined | null) {
  if (!token) return;
  await platformDb.session.deleteMany({ where: { tokenHash: hashToken(token) } });
}

/** Change le cabinet actif d'une session (utilisateur membre de plusieurs cabinets). */
export async function switchSessionCabinet(sessionId: string, cabinetId: string) {
  await platformDb.session.update({ where: { id: sessionId }, data: { cabinetId } });
}

export async function purgeExpiredSessions() {
  const { count } = await platformDb.session.deleteMany({ where: { expiresAt: { lt: new Date() } } });
  return count;
}

/** Comparaison à temps constant, pour les jetons hors session (invitations, liens). */
export function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}

export const sessionCookieOptions = () =>
  ({
    httpOnly: true,
    sameSite: "lax" as const,
    secure: env().NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_TTL_MS / 1000,
  });
