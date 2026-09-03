"use client";

import { useState, useTransition } from "react";
import { deleteDocumentAction, setDocumentStatusAction } from "@/app/actions/app";
import { Button, Modal } from "@/components/ui";

/**
 * Suivi d'une pièce : validation, refus, suppression.
 *
 * La suppression retire aussi le fichier du stockage — elle est donc
 * irréversible, et confirmée. Le refus ne l'est pas : il se corrige en
 * approuvant.
 */
export function DocumentActions({
  id,
  filename,
  status,
  canApprove,
  canDelete,
}: {
  id: string;
  filename: string;
  status: string;
  canApprove: boolean;
  canDelete: boolean;
}) {
  const [pending, start] = useTransition();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = (next: "approved" | "rejected" | "archived") => {
    setError(null);
    start(async () => {
      const result = await setDocumentStatusAction(id, next);
      if (result.error) setError(result.error);
    });
  };

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {canApprove && status !== "approved" ? (
        <Button size="sm" variant="ghost" disabled={pending} onClick={() => set("approved")}>
          Valider
        </Button>
      ) : null}
      {canApprove && status !== "rejected" ? (
        <Button size="sm" variant="ghost" disabled={pending} onClick={() => set("rejected")}>
          Refuser
        </Button>
      ) : null}
      {canApprove && status !== "archived" ? (
        <Button size="sm" variant="ghost" disabled={pending} onClick={() => set("archived")}>
          Archiver
        </Button>
      ) : null}
      {canDelete ? (
        <Button size="sm" variant="ghost" disabled={pending} onClick={() => setConfirming(true)}>
          Supprimer
        </Button>
      ) : null}

      {error ? <span className="text-xs text-danger">{error}</span> : null}

      <Modal
        open={confirming}
        onClose={() => setConfirming(false)}
        title="Supprimer ce document ?"
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirming(false)}>
              Annuler
            </Button>
            <Button
              variant="danger"
              disabled={pending}
              onClick={() => {
                setError(null);
                start(async () => {
                  const result = await deleteDocumentAction(id);
                  if (result.error) setError(result.error);
                  setConfirming(false);
                });
              }}
            >
              {pending ? "Suppression…" : "Supprimer définitivement"}
            </Button>
          </>
        }
      >
        <p>
          <strong>{filename}</strong> sera retiré du dossier et effacé du stockage.
        </p>
        <p className="mt-2 text-xs text-muted">
          Le fichier n&apos;est pas récupérable. Pour retirer une pièce d&apos;une liste sans la
          perdre, utilisez « Archiver ».
        </p>
      </Modal>
    </div>
  );
}
