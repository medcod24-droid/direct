"use client";

import { useActionState } from "react";
import { createClientAction, type ActionState } from "@/app/actions/app";
import { Alert, Button } from "@/components/ui";
import { ClientFields } from "../ClientFields";

const initial: ActionState = {};

export function NewClientForm({ cndpMode }: { cndpMode: string }) {
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
      />

      <div className="flex justify-end gap-2">
        <Button type="submit" variant="primary" disabled={pending}>
          {pending ? "Création…" : "Créer le dossier"}
        </Button>
      </div>
    </form>
  );
}
