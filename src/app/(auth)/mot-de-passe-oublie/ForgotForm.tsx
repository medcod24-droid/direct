"use client";

import { useActionState } from "react";
import { requestPasswordResetAction, type ActionState } from "@/app/actions/auth";
import { Alert, Button, Field, Input } from "@/components/ui";

const initial: ActionState = {};

/**
 * Demande de lien de réinitialisation.
 *
 * La confirmation ne dit pas si l'adresse existe : le même message s'affiche
 * dans tous les cas, sans quoi le formulaire aurait permis de savoir qui a un
 * compte.
 */
export function ForgotForm() {
  const [state, action, pending] = useActionState(requestPasswordResetAction, initial);

  if (state.ok) {
    return (
      <Alert tone="success" title="Courriel envoyé">
        Si un compte existe à cette adresse, le lien vient de partir. Il est valable une heure.
        Pensez à regarder vos courriers indésirables.
      </Alert>
    );
  }

  return (
    <form action={action} className="grid gap-4">
      {state.error ? <Alert tone="danger">{state.error}</Alert> : null}
      <Field label="Adresse e-mail" htmlFor="email" error={state.fieldErrors?.email?.[0]}>
        <Input id="email" name="email" type="email" autoComplete="email" required autoFocus />
      </Field>
      <Button type="submit" disabled={pending}>
        {pending ? "Envoi…" : "Recevoir le lien"}
      </Button>
    </form>
  );
}
