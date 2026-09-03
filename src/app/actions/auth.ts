"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { createSession, destroySession, SESSION_COOKIE, sessionCookieOptions } from "@/lib/auth/session";
import { getAuthContext } from "@/lib/authz/guard";
import { recordAudit } from "@/lib/audit";
import { toPublicError } from "@/lib/errors";
import { login, signupCabinet } from "@/server/services/auth";
import { acceptInvitation } from "@/server/services/members";

export type ActionState = { error?: string; fieldErrors?: Record<string, string[]> };

async function requestMeta() {
  const h = await headers();
  const forwarded = h.get("x-forwarded-for");
  return {
    ip: forwarded ? (forwarded.split(",")[0]?.trim() ?? null) : h.get("x-real-ip"),
    userAgent: h.get("user-agent"),
  };
}

export async function loginAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  let destination = "/dashboard";
  try {
    const meta = await requestMeta();
    const result = await login(
      { email: formData.get("email"), password: formData.get("password") },
      meta,
    );
    const store = await cookies();
    store.set(SESSION_COOKIE, result.token, sessionCookieOptions());
    destination = result.role === "client" ? "/portal" : "/dashboard";
  } catch (error) {
    return { error: toPublicError(error).message };
  }
  redirect(destination);
}

export async function signupAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const meta = await requestMeta();
    const result = await signupCabinet(
      {
        cabinetName: formData.get("cabinetName"),
        ordre: formData.get("ordre"),
        ordreNum: formData.get("ordreNum"),
        name: formData.get("name"),
        email: formData.get("email"),
        password: formData.get("password"),
        acceptTerms: formData.get("acceptTerms") === "on",
      },
      meta,
    );
    const store = await cookies();
    store.set(SESSION_COOKIE, result.token, sessionCookieOptions());
  } catch (error) {
    return { error: toPublicError(error).message };
  }
  redirect("/dashboard");
}

export async function logoutAction() {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  const ctx = await getAuthContext();
  if (ctx) {
    await recordAudit({
      action: "auth.logout",
      cabinetId: ctx.cabinet.id,
      userId: ctx.user.id,
      ip: ctx.ip,
    });
  }
  await destroySession(token);
  store.delete(SESSION_COOKIE);
  redirect("/login");
}

/**
 * Acceptation d'une invitation. Non authentifiée : c'est le jeton du lien qui
 * fait foi. La session est ouverte dans la foulée, comme après une inscription.
 */
export async function acceptInvitationAction(
  token: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const meta = await requestMeta();
    const { user, cabinetId } = await acceptInvitation(
      token,
      { name: formData.get("name"), password: formData.get("password") },
      meta,
    );
    const { token: sessionToken } = await createSession({
      userId: user.id,
      cabinetId,
      ip: meta.ip,
      userAgent: meta.userAgent,
    });
    const store = await cookies();
    store.set(SESSION_COOKIE, sessionToken, sessionCookieOptions());
  } catch (error) {
    const { message, fieldErrors } = toPublicError(error);
    return { error: message, fieldErrors };
  }
  redirect("/dashboard");
}
