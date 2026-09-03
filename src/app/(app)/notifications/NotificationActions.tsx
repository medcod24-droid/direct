"use client";

import { useTransition } from "react";
import { readAllNotificationsAction, readNotificationAction } from "@/app/actions/app";
import { Button } from "@/components/ui";

/** Marque toutes les notifications comme lues. */
export function MarkAllRead({ unread }: { unread: number }) {
  const [pending, start] = useTransition();
  if (unread === 0) return null;

  return (
    <Button
      variant="secondary"
      disabled={pending}
      onClick={() => start(() => readAllNotificationsAction().then(() => undefined))}
    >
      {pending ? "…" : `Tout marquer comme lu (${unread})`}
    </Button>
  );
}

/** Marque une notification comme lue, sans quitter la liste. */
export function MarkRead({ id }: { id: string }) {
  const [pending, start] = useTransition();

  return (
    <Button
      size="sm"
      variant="ghost"
      disabled={pending}
      onClick={() => start(() => readNotificationAction(id).then(() => undefined))}
    >
      {pending ? "…" : "Marquer lu"}
    </Button>
  );
}
