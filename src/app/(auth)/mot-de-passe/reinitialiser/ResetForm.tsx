"use client";

import { useActionState } from "react";
import { resetPasswordAction, type ActionState } from "@/app/actions/auth";
import { Alert, Button, Field, Input } from "@/components/ui";

const initial: ActionState = {};

export function ResetForm({ token }: { token: string }) {
  const [state, action, pending] = useActionState(resetPasswordAction, initial);

  return (
    <form action={action} className="grid gap-4">
      {state.error ? <Alert tone="danger">{state.error}</Alert> : null}
      <input type="hidden" name="jeton" value={token} />
      <Field
        label="Nouveau mot de passe"
        htmlFor="password"
        hint="Il remplacera l'ancien, et fermera les sessions ouvertes."
        error={state.fieldErrors?.password?.[0]}
      >
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          autoFocus
        />
      </Field>
      <Button type="submit" disabled={pending}>
        {pending ? "Enregistrement…" : "Enregistrer le mot de passe"}
      </Button>
    </form>
  );
}
