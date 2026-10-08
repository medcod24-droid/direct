"use client";

import { useActionState } from "react";
import { createClientAction, type ActionState } from "@/app/actions/app";
import { Alert } from "@/components/ui";
import type { PickerOption } from "@/components/ui";
import { ClientFields } from "../ClientFields";
import { FormBar } from "../FormBar";

const initial: ActionState = {};

export function NewClientForm({
  cndpMode,
  referrers,
  canConfidential,
}: {
  cndpMode: string;
  referrers: PickerOption[];
  canConfidential: boolean;
}) {
  const [state, action, pending] = useActionState(createClientAction, initial);

  // Après un refus, on réaffiche ce qui avait été saisi : sur une vingtaine de
  // champs, tout retaper pour une seule erreur est punitif.
  const value = (name: string, fallback = "") => state.values?.[name] ?? fallback;
  const checked = (name: string) => state.values?.[name] === "on";
  const fieldError = (name: string) => state.fieldErrors?.[name]?.[0];

  return (
    <form action={action} className="grid gap-4">
      {state.error ? <Alert tone="danger">{state.error}</Alert> : null}

      <ClientFields
        value={value}
        checked={checked}
        fieldError={fieldError}
        cndpMode={cndpMode}
        referrers={referrers}
        canConfidential={canConfidential}
      />

      <FormBar
        state={state}
        pending={pending}
        submitLabel="Créer le dossier"
        pendingLabel="Création…"
      />
    </form>
  );
}
