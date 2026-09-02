import { platformDb } from "@/lib/db/tenant";
import { env } from "@/lib/env";

/**
 * Service de notification.
 *
 * Le cœur applicatif ne connaît qu'une fonction : `notify()`. Les canaux sont des
 * implémentations interchangeables derrière `Channel`. Ajouter WhatsApp Business API ou
 * un fournisseur SMS ne demandera aucune modification du code métier, et l'application
 * continue de fonctionner si un canal externe est indisponible.
 */

export type NotificationPayload = {
  type: string;
  title: string;
  body: string;
  link?: string;
};

export type Recipient = {
  userId: string;
  email?: string | null;
  phone?: string | null;
  locale?: string;
};

export interface Channel {
  readonly name: string;
  /** Un canal indisponible doit renvoyer false, jamais faire échouer l'action métier. */
  send(recipient: Recipient, payload: NotificationPayload): Promise<boolean>;
}

/** Canal interne : la notification apparaît dans le centre de notifications. */
class InAppChannel implements Channel {
  readonly name = "in_app";
  constructor(private readonly cabinetId: string) {}

  async send(recipient: Recipient, payload: NotificationPayload) {
    await platformDb.notification.create({
      data: {
        cabinetId: this.cabinetId,
        userId: recipient.userId,
        type: payload.type,
        title: payload.title,
        body: payload.body,
        link: payload.link ?? null,
      },
    });
    return true;
  }
}

/** Canal e-mail. En développement, le message est écrit dans les logs. */
class EmailChannel implements Channel {
  readonly name = "email";

  async send(recipient: Recipient, payload: NotificationPayload) {
    if (!recipient.email) return false;
    if (env().EMAIL_PROVIDER === "console") {
      console.info(`[email] → ${recipient.email} : ${payload.title} — ${payload.body}`);
      return true;
    }
    // Le transport SMTP réel sera branché ici ; l'interface ne changera pas.
    console.warn("[email] fournisseur SMTP non configuré, message non envoyé");
    return false;
  }
}

/**
 * Emplacement prévu pour WhatsApp Business API (fournisseur officiel uniquement).
 * Point d'attention CNDP : les messages transitent par des serveurs hors du Maroc,
 * ce qui constitue un transfert de données à notifier et à fonder sur le consentement
 * exprès du destinataire. Le canal reste donc désactivé par défaut.
 */
class WhatsAppChannel implements Channel {
  readonly name = "whatsapp";
  async send() {
    return false;
  }
}

export function channelsFor(cabinetId: string): Channel[] {
  return [new InAppChannel(cabinetId), new EmailChannel(), new WhatsAppChannel()];
}

/**
 * Envoie une notification à un utilisateur sur tous les canaux disponibles.
 * L'échec d'un canal n'interrompt pas les autres et ne remonte jamais à l'appelant.
 */
export async function notify(
  cabinetId: string,
  userId: string,
  payload: NotificationPayload,
): Promise<void> {
  const user = await platformDb.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, phone: true, locale: true },
  });
  if (!user) return;

  const recipient: Recipient = {
    userId: user.id,
    email: user.email,
    phone: user.phone,
    locale: user.locale,
  };

  for (const channel of channelsFor(cabinetId)) {
    try {
      await channel.send(recipient, payload);
    } catch (error) {
      console.error(`[notifications] canal ${channel.name} en échec`, error);
    }
  }
}

export async function markNotificationRead(userId: string, notificationId: string) {
  await platformDb.notification.updateMany({
    where: { id: notificationId, userId },
    data: { readAt: new Date() },
  });
}

export async function markAllNotificationsRead(userId: string) {
  await platformDb.notification.updateMany({
    where: { userId, readAt: null },
    data: { readAt: new Date() },
  });
}
