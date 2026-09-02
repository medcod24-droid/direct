"use client";

import { useState, useTransition } from "react";
import {
  generateDeadlinesAction,
  logOutageAction,
  updateDeadlineAction,
} from "@/app/actions/app";
import { Button, Modal, Textarea } from "@/components/ui";

/** Génération du calendrier de l'année pour tous les dossiers actifs. */
export function GenerateButton({ year }: { year: number }) {
  const [pending, start] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  return (
    <div className="flex items-center gap-3">
      {message ? <span className="text-sm text-muted">{message}</span> : null}
      <Button
        variant="secondary"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const result = await generateDeadlinesAction(year);
            setMessage(result.error ?? result.message ?? null);
          })
        }
      >
        {pending ? "Génération…" : `Générer ${year}`}
      </Button>
    </div>
  );
}

/** Passage déclaré / payé, et journal du « mode panne » d'un portail public. */
export function DeadlineActions({ id, status }: { id: string; status: string }) {
  const [pending, start] = useTransition();
  const [outageOpen, setOutageOpen] = useState(false);
  const [outageMessage, setOutageMessage] = useState("");

  const done = status === "paid";

  return (
    <div className="flex items-center gap-1.5">
      {!done ? (
        <>
          <Button
            size="sm"
            variant="ghost"
            disabled={pending}
            onClick={() => start(() => updateDeadlineAction(id, "declare").then(() => undefined))}
          >
            Déclarée
          </Button>
          <Button
            size="sm"
            variant="secondary"
            disabled={pending}
            onClick={() => start(() => updateDeadlineAction(id, "pay").then(() => undefined))}
          >
            Payée
          </Button>
        </>
      ) : (
        <Button
          size="sm"
          variant="ghost"
          disabled={pending}
          onClick={() => start(() => updateDeadlineAction(id, "reopen").then(() => undefined))}
        >
          Rouvrir
        </Button>
      )}

      <Button size="sm" variant="ghost" onClick={() => setOutageOpen(true)}>
        Panne
      </Button>

      <Modal
        open={outageOpen}
        onClose={() => setOutageOpen(false)}
        title="Signaler une panne de portail"
      >
        <p className="text-sm text-ink2 mb-3">
          La tentative est horodatée et conservée. Elle pourra appuyer une demande de remise
          de majorations si le portail était indisponible.
        </p>
        <Textarea
          rows={3}
          value={outageMessage}
          onChange={(event) => setOutageMessage(event.target.value)}
          placeholder="Message d'erreur affiché par SIMPL ou DAMANCOM"
        />
        <div className="flex justify-end gap-2 mt-3">
          <Button variant="ghost" onClick={() => setOutageOpen(false)}>
            Annuler
          </Button>
          <Button
            disabled={pending || outageMessage.trim().length === 0}
            onClick={() =>
              start(async () => {
                await logOutageAction(id, "simpl", outageMessage);
                setOutageOpen(false);
                setOutageMessage("");
              })
            }
          >
            Enregistrer
          </Button>
        </div>
      </Modal>
    </div>
  );
}
