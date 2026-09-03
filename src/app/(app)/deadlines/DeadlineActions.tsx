"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import {
  generateDeadlinesAction,
  listProofCandidatesAction,
  logOutageAction,
  updateDeadlineAction,
} from "@/app/actions/app";
import { Alert, Button, Modal, Select, Textarea } from "@/components/ui";

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
export function DeadlineActions({
  id,
  clientId,
  status,
  hasProof,
}: {
  id: string;
  clientId: string;
  status: string;
  hasProof: boolean;
}) {
  const [pending, start] = useTransition();
  const [outageOpen, setOutageOpen] = useState(false);
  const [outageMessage, setOutageMessage] = useState("");
  const [payOpen, setPayOpen] = useState(false);
  const [proofs, setProofs] = useState<{ id: string; filename: string }[] | null>(null);
  const [proofId, setProofId] = useState("");
  const [error, setError] = useState<string | null>(null);

  const done = status === "paid";

  /**
   * Le passage au vert exige une preuve de dépôt. Si l'échéance en porte déjà une
   * (jointe à la déclaration), le serveur l'accepte : on marque directement payée.
   */
  function pay() {
    setError(null);
    if (hasProof) {
      start(async () => {
        const result = await updateDeadlineAction(id, "pay");
        if (result.error) setError(result.error);
      });
      return;
    }
    setPayOpen(true);
    setProofs(null);
    start(async () => {
      const result = await listProofCandidatesAction(clientId);
      setProofs(result.items ?? []);
      if (result.error) setError(result.error);
    });
  }

  function confirmPay() {
    setError(null);
    start(async () => {
      const result = await updateDeadlineAction(id, "pay", { proofDocumentId: proofId });
      if (result.error) setError(result.error);
      else {
        setPayOpen(false);
        setProofId("");
      }
    });
  }

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
          <Button size="sm" variant="secondary" disabled={pending} onClick={pay}>
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
        open={payOpen}
        onClose={() => setPayOpen(false)}
        title="Preuve de dépôt"
      >
        <p className="text-sm text-ink2 mb-3">
          Une échéance ne passe au vert qu&apos;avec son accusé de dépôt : c&apos;est la pièce
          que le cabinet produira en cas de contrôle. Choisissez-la parmi les documents du
          dossier.
        </p>

        {error ? (
          <div className="mb-3">
            <Alert tone="danger">{error}</Alert>
          </div>
        ) : null}

        {proofs === null ? (
          <p className="text-sm text-muted">Chargement des documents du dossier…</p>
        ) : proofs.length === 0 ? (
          <Alert tone="warning">
            Aucun document dans ce dossier. Déposez d&apos;abord l&apos;accusé du portail
            depuis la fiche du dossier, puis revenez marquer l&apos;échéance payée.
          </Alert>
        ) : (
          <Select
            aria-label="Document servant de preuve"
            value={proofId}
            onChange={(event) => setProofId(event.target.value)}
          >
            <option value="">Choisir un document…</option>
            {proofs.map((proof) => (
              <option key={proof.id} value={proof.id}>
                {proof.filename}
              </option>
            ))}
          </Select>
        )}

        <div className="flex justify-between items-center gap-2 mt-3">
          <Link
            href={`/clients/${clientId}`}
            className="text-xs text-muted underline underline-offset-2"
          >
            Ouvrir le dossier
          </Link>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => setPayOpen(false)}>
              Annuler
            </Button>
            <Button disabled={pending || !proofId} onClick={confirmPay}>
              Marquer payée
            </Button>
          </div>
        </div>
      </Modal>

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
