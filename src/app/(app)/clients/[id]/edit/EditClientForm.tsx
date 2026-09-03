"use client";

import Link from "next/link";
import { useActionState } from "react";
import { updateClientAction, type ActionState } from "@/app/actions/app";
import { Alert, Button } from "@/components/ui";
import { ClientFields } from "../../ClientFields";

const initial: ActionState = {};

/**
 * Modification d'un dossier.
 *
 * Les mêmes champs que la création, pré-remplis avec la valeur enregistrée.
 * Après un refus, c'est la saisie refusée qui est réaffichée — pas la valeur en
 * base — pour que la correction se fasse sur ce qui vient d'être tapé.
 */
export function EditClientForm({
  clientId,
  cndpMode,
  current,
}: {
  clientId: string;
  cndpMode: string;
  current: Record<string, string>;
}) {
  const action = updateClientAction.bind(null, clientId);
  const [state, formAction, pending] = useActionState(action, initial);

  const value = (name: string, fallback = "") =>
    state.values?.[name] ?? current[name] ?? fallback;
  const checked = (name: string) =>
    state.values ? state.values[name] === "on" : current[name] === "on";
  const fieldError = (name: string) => state.fieldErrors?.[name]?.[0];

  return (
    <form action={formAction} className="grid gap-4">
      {state.error ? <Alert tone="danger">{state.error}</Alert> : null}
      {state.ok ? <Alert tone="success">{state.message}</Alert> : null}

      <ClientFields
        value={value}
        checked={checked}
        fieldError={fieldError}
        cndpMode={cndpMode}
      />

      <div className="flex justify-end gap-2">
        <Button href={`/clients/${clientId}`} variant="ghost">
          Annuler
        </Button>
        <Button type="submit" variant="primary" disabled={pending}>
          {pending ? "Enregistrement…" : "Enregistrer les modifications"}
        </Button>
      </div>
    </form>
  );
}
