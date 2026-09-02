"use client";

import { useActionState, useState } from "react";
import { uploadDocumentAction, type ActionState } from "@/app/actions/app";
import { Alert, Button, Field, Input, Modal } from "@/components/ui";

const initial: ActionState = {};

/** Dépôt d'un document dans le dossier. Le fichier ne transite que par le serveur. */
export function UploadForm({ clientId }: { clientId: string }) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(uploadDocumentAction, initial);

  return (
    <>
      <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>
        Ajouter un document
      </Button>
      <Modal open={open} onClose={() => setOpen(false)} title="Ajouter un document">
        <form action={action} className="grid gap-3">
          <input type="hidden" name="clientId" value={clientId} />
          {state.error ? <Alert tone="danger">{state.error}</Alert> : null}
          {state.ok ? <Alert tone="success">{state.message}</Alert> : null}

          <Field
            label="Fichier"
            htmlFor="file"
            hint="PDF, image, Excel ou Word. 25 Mo maximum."
          >
            <Input id="file" name="file" type="file" required />
          </Field>
          <Field label="Date du document" htmlFor="documentDate">
            <Input id="documentDate" name="documentDate" type="date" />
          </Field>
          <Field
            label="Date d'expiration"
            htmlFor="expiresAt"
            hint="Pour une attestation de régularité fiscale, par exemple."
          >
            <Input id="expiresAt" name="expiresAt" type="date" />
          </Field>

          <div className="flex gap-2 justify-end">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Annuler
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Envoi…" : "Téléverser"}
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
