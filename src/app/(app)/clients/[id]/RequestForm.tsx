"use client";

import { useActionState, useState } from "react";
import { createRequestAction, type ActionState } from "@/app/actions/app";
import { Alert, Button, Field, Input, Modal, Textarea } from "@/components/ui";

const initial: ActionState = {};

/** Demande de pièce au client, depuis la fiche du dossier. */
export function RequestForm({ clientId }: { clientId: string }) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(createRequestAction, initial);

  return (
    <>
      <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>
        Demander une pièce
      </Button>
      <Modal open={open} onClose={() => setOpen(false)} title="Demander une pièce au client">
        <form action={action} className="grid gap-3">
          <input type="hidden" name="clientId" value={clientId} />
          {state.error ? <Alert tone="danger">{state.error}</Alert> : null}
          {state.ok ? <Alert tone="success">{state.message}</Alert> : null}

          <Field label="Pièce demandée" htmlFor="title">
            <Input id="title" name="title" required placeholder="Relevé bancaire" />
          </Field>
          <Field label="Période" htmlFor="periodLabel">
            <Input id="periodLabel" name="periodLabel" placeholder="janvier 2027" />
          </Field>
          <Field label="À fournir avant le" htmlFor="dueDate">
            <Input id="dueDate" name="dueDate" type="date" />
          </Field>
          <Field label="Précisions" htmlFor="description">
            <Textarea id="description" name="description" rows={3} />
          </Field>

          <div className="flex gap-2 justify-end">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Annuler
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Envoi…" : "Envoyer la demande"}
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
