import { env, isProduction } from "@/lib/env";

export type MailMessage = {
  to: string;
  subject: string;
  /** Version HTML, déjà mise en page (voir `templates.ts`). */
  html: string;
  /** Version texte : certains clients ne lisent que celle-là, et elle fait foi. */
  text: string;
};

/**
 * Envoi d'un courriel.
 *
 * Trois transports derrière le même appel : `console` écrit le message dans les
 * logs (développement et tests), `resend` passe par une API HTTP — rien à
 * installer, rien à ouvrir en sortie —, `smtp` par la boîte du cabinet.
 *
 * **Un envoi raté ne fait jamais échouer l'action qui l'a déclenché.** Un compte
 * créé reste créé si le courriel de bienvenue ne part pas ; c'est l'appelant qui
 * décide quoi dire à l'utilisateur, à partir du booléen renvoyé.
 */
export async function sendMail(message: MailMessage): Promise<boolean> {
  const config = env();
  try {
    switch (config.EMAIL_PROVIDER) {
      case "console":
        console.info(
          `[email] → ${message.to}\n  sujet : ${message.subject}\n${message.text.replace(/^/gm, "  ")}`,
        );
        return true;
      case "resend":
        return await viaResend(message, config.RESEND_API_KEY, config.EMAIL_FROM);
      case "smtp":
        return await viaSmtp(message, config.SMTP_URL, config.EMAIL_FROM);
      default:
        return false;
    }
  } catch (error) {
    console.error("[email] envoi impossible", error);
    return false;
  }
}

async function viaResend(
  message: MailMessage,
  apiKey: string | undefined,
  from: string,
): Promise<boolean> {
  if (!apiKey) {
    console.error("[email] RESEND_API_KEY manquante : message non envoyé");
    return false;
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from,
      to: [message.to],
      subject: message.subject,
      html: message.html,
      text: message.text,
    }),
  });

  if (!response.ok) {
    // Le corps de la réponse peut contenir l'adresse : on ne garde que le statut.
    console.error(`[email] Resend a refusé l'envoi (HTTP ${response.status})`);
    return false;
  }
  return true;
}

async function viaSmtp(
  message: MailMessage,
  smtpUrl: string | undefined,
  from: string,
): Promise<boolean> {
  if (!smtpUrl) {
    console.error("[email] SMTP_URL manquante : message non envoyé");
    return false;
  }

  // Import différé : la bibliothèque n'est chargée que par le transport qui s'en
  // sert, et ne pèse pas sur les déploiements qui passent par l'API HTTP.
  const { createTransport } = await import("nodemailer");
  const transport = createTransport(smtpUrl);
  await transport.sendMail({
    from,
    to: message.to,
    subject: message.subject,
    html: message.html,
    text: message.text,
  });
  return true;
}

/**
 * Le cabinet peut-il réellement envoyer un courriel ?
 *
 * « console » est le mode de développement : en production, il signifie qu'aucun
 * message ne part — et que le mot de passe oublié ne sert à rien. Un fournisseur
 * choisi sans sa clé est une configuration incomplète, qu'il vaut mieux voir
 * dans la sonde que découvrir le jour où quelqu'un perd son mot de passe.
 */
export function mailStatus(
  config: {
    EMAIL_PROVIDER: "console" | "resend" | "smtp";
    RESEND_API_KEY?: string;
    SMTP_URL?: string;
  } = env(),
  production: boolean = isProduction(),
): "ok" | "console" | "incomplet" {
  switch (config.EMAIL_PROVIDER) {
    case "console":
      return production ? "console" : "ok";
    case "resend":
      return config.RESEND_API_KEY ? "ok" : "incomplet";
    case "smtp":
      return config.SMTP_URL ? "ok" : "incomplet";
    default:
      return "incomplet";
  }
}
