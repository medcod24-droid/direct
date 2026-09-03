"use client";

import { useActionState } from "react";
import { acceptInvitationAction, type ActionState } from "@/app/actions/auth";
import { Alert, Button, Field, Input } from "@/components/ui";

const initial: ActionState = {};

export function AcceptForm({ token }: { token: string }) {
  const action = acceptInvitationAction.bind(null, token);
  const [state, formAction, pending] = useActionState(action, initial);

  return (
    <form action={formAction} className="grid gap-3">
      {state.error ? <Alert tone="danger">{state.error}</Alert> : null}

      <Field label="Votre nom" htmlFor="name" error={state.fieldErrors?.name?.[0]}>
        <Input id="name" name="name" required autoFocus autoComplete="name" />
      </Field>

      <Field
        label="Mot de passe"
        htmlFor="password"
        hint="12 caractères minimum."
        error={state.fieldErrors?.password?.[0]}
      >
        <Input
          id="password"
          name="password"
          type="password"
          required
          autoComplete="new-password"
        />
      </Field>

      <Button type="submit" variant="primary" fullWidth disabled={pending}>
        {pending ? "Activation…" : "Rejoindre le cabinet"}
      </Button>
    </form>
  );
}
