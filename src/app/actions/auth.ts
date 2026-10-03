"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { createSession, destroySession, SESSION_COOKIE, sessionCookieOptions } from "@/lib/auth/session";
import { getAuthContext } from "@/lib/authz/guard";
import { recordAudit } from "@/lib/audit";
import { toPublicError } from "@/lib/errors";
import { login, signupCabinet } from "@/server/services/auth";
import { requestPasswordReset, resetPassword } from "@/server/services/password-reset";

export type ActionState = { error?: string; fieldErrors?: Record<string, string[]>; ok?: boolean };

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

/**
 * Demande de réinitialisation.
 *
 * La réponse est la même que l'adresse existe ou non : l'écran affiche « si un
 * compte existe à cette adresse, le courriel part ». Dire le contraire aurait
 * fait de ce formulaire un annuaire du cabinet.
 */
export async function requestPasswordResetAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const meta = await requestMeta();
    await requestPasswordReset({ email: formData.get("email") }, meta);
    return { ok: true };
  } catch (error) {
    const { message, fieldErrors } = toPublicError(error);
    return { error: message, fieldErrors };
  }
}

/** Choix du nouveau mot de passe, depuis le lien reçu par courriel. */
export async function resetPasswordAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const meta = await requestMeta();
    await resetPassword(
      { token: formData.get("jeton"), password: formData.get("password") },
      meta,
    );
  } catch (error) {
    const { message, fieldErrors } = toPublicError(error);
    return { error: message, fieldErrors };
  }
  // Les sessions ont été fermées : on repart de l'écran de connexion.
  redirect("/login?reinitialise=1");
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

