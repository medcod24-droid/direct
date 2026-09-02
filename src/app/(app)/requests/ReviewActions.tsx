"use client";

import { useState, useTransition } from "react";
import { reviewRequestAction } from "@/app/actions/app";
import { Alert, Button, Modal, Textarea } from "@/components/ui";

/** Validation ou refus motivé d'une pièce déposée par le client. */
export function ReviewActions({ requestId }: { requestId: string }) {
  const [pending, start] = useTransition();
  const [rejectOpen, setRejectOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="flex items-center gap-2">
      <Button
        size="sm"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const result = await reviewRequestAction(requestId, "approve");
            setError(result.error ?? null);
          })
        }
      >
        Valider
      </Button>
      <Button size="sm" variant="secondary" onClick={() => setRejectOpen(true)}>
        Refuser
      </Button>

      <Modal open={rejectOpen} onClose={() => setRejectOpen(false)} title="Refuser la pièce">
        <p className="text-sm text-ink2 mb-3">
          Le client verra ce motif et pourra déposer une nouvelle version.
        </p>
        {error ? <Alert tone="danger">{error}</Alert> : null}
        <Textarea
          rows={3}
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          placeholder="Document illisible, période incorrecte…"
        />
        <div className="flex justify-end gap-2 mt-3">
          <Button variant="ghost" onClick={() => setRejectOpen(false)}>
            Annuler
          </Button>
          <Button
            disabled={pending || reason.trim().length === 0}
            onClick={() =>
              start(async () => {
                const result = await reviewRequestAction(requestId, "reject", reason);
                if (result.error) setError(result.error);
                else {
                  setRejectOpen(false);
                  setReason("");
                }
              })
            }
          >
            Refuser et notifier
          </Button>
        </div>
      </Modal>
    </div>
  );
}
