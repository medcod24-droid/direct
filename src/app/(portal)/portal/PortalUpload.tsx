"use client";

import { useActionState } from "react";
import { submitRequestAction, type ActionState } from "@/app/actions/app";
import { Alert, Button, Input } from "@/components/ui";

const initial: ActionState = {};

/** Dépôt d'une pièce depuis un téléphone : un champ, un bouton. */
export function PortalUpload({ requestId }: { requestId: string }) {
  const [state, action, pending] = useActionState(submitRequestAction, initial);

  return (
    <form action={action} className="grid gap-2">
      <input type="hidden" name="requestId" value={requestId} />
      {state.error ? <Alert tone="danger">{state.error}</Alert> : null}
      {state.ok ? <Alert tone="success">{state.message}</Alert> : null}
      <div className="flex flex-wrap gap-2">
        <Input
          name="file"
          type="file"
          required
          accept="image/*,application/pdf"
          capture="environment"
          className="flex-1 min-w-48"
        />
        <Button type="submit" disabled={pending}>
          {pending ? "Envoi…" : "Envoyer"}
        </Button>
      </div>
    </form>
  );
}
