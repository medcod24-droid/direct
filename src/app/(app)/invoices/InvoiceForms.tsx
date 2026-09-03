"use client";

import { useActionState, useState, useTransition } from "react";
import {
  createInvoiceAction,
  recordPaymentAction,
  type ActionState,
} from "@/app/actions/app";
import { Alert, Button, Card, Field, Input, Modal, Select } from "@/components/ui";

const initial: ActionState = {};

export type ClientOption = { id: string; label: string };

const today = () => new Date().toISOString().slice(0, 10);
const inDays = (days: number) =>
  new Date(Date.now() + days * 86400000).toISOString().slice(0, 10);

/**
 * Création d'une facture d'honoraires.
 *
 * Les montants se saisissent en dirhams ; la conversion en centimes est faite par
 * l'action serveur, la base ne stockant que des entiers.
 */
export function NewInvoice({
  clients,
  suggestedReference,
}: {
  clients: ClientOption[];
  suggestedReference: string;
}) {
  const [state, action, pending] = useActionState(createInvoiceAction, initial);
  const [open, setOpen] = useState(false);
  const expanded = open || Boolean(state.error);
  const kept = (name: string, fallback = "") => state.values?.[name] ?? fallback;
  const fieldError = (name: string) => state.fieldErrors?.[name]?.[0];

  if (!expanded) {
    return (
      <div className="flex items-center gap-3">
        {state.ok ? <span className="text-sm text-muted">{state.message}</span> : null}
        <Button onClick={() => setOpen(true)} disabled={clients.length === 0}>
          Nouvelle facture
        </Button>
      </div>
    );
  }

  return (
    <Card title="Nouvelle facture">
      <form action={action} className="grid gap-3">
        {state.error ? <Alert tone="danger">{state.error}</Alert> : null}

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Dossier" htmlFor="clientId" error={fieldError("clientId")}>
            <Select key={kept("clientId")} id="clientId" name="clientId" required defaultValue={kept("clientId")}>
              <option value="">Choisir un dossier…</option>
              {clients.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.label}
                </option>
              ))}
            </Select>
          </Field>

          <Field
            label="Référence"
            htmlFor="reference"
            hint="Proposée automatiquement, modifiable."
            error={fieldError("reference")}
          >
            <Input
              id="reference"
              name="reference"
              required
              defaultValue={kept("reference", suggestedReference)}
            />
          </Field>

          <Field label="Objet" htmlFor="label" optional error={fieldError("label")}>
            <Input
              id="label"
              name="label"
              placeholder="Honoraires de tenue comptable"
              defaultValue={kept("label")}
            />
          </Field>

          <Field
            label="Montant HT (MAD)"
            htmlFor="amount"
            error={fieldError("amount")}
          >
            <Input
              id="amount"
              name="amount"
              type="number"
              min={1}
              step="0.01"
              required
              defaultValue={kept("amount")}
            />
          </Field>

          <Field label="TVA (%)" htmlFor="vatRate" error={fieldError("vatRate")}>
            <Input
              id="vatRate"
              name="vatRate"
              type="number"
              min={0}
              max={100}
              defaultValue={kept("vatRate", "20")}
            />
          </Field>

          <Field label="Date d'émission" htmlFor="issuedAt" error={fieldError("issuedAt")}>
            <Input
              id="issuedAt"
              name="issuedAt"
              type="date"
              required
              defaultValue={kept("issuedAt", today())}
            />
          </Field>

          <Field label="Échéance" htmlFor="dueDate" error={fieldError("dueDate")}>
            <Input
              id="dueDate"
              name="dueDate"
              type="date"
              required
              defaultValue={kept("dueDate", inDays(30))}
            />
          </Field>
        </div>

        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
            Annuler
          </Button>
          <Button type="submit" variant="primary" disabled={pending}>
            {pending ? "Enregistrement…" : "Enregistrer la facture"}
          </Button>
        </div>
      </form>
    </Card>
  );
}

/**
 * Encaissement sur une facture.
 *
 * Le reste dû est proposé par défaut, mais reste modifiable : un règlement
 * partiel est courant, et le service bascule alors la facture en « partiel ».
 */
export function RecordPayment({
  invoiceId,
  reference,
  remaining,
}: {
  invoiceId: string;
  reference: string;
  remaining: number;
}) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [amount, setAmount] = useState("");
  const [mode, setMode] = useState("transfer");
  const [paidAt, setPaidAt] = useState(today());

  /**
   * Le montant est réinitialisé à chaque ouverture, pas au montage : après un
   * encaissement partiel la ligne reste à l'écran, et un état conservé
   * proposerait le reste dû d'avant plutôt que celui d'après.
   */
  function openWith() {
    setError(null);
    setAmount((remaining / 100).toFixed(2));
    setPaidAt(today());
    setOpen(true);
  }

  function submit() {
    setError(null);
    const form = new FormData();
    form.set("invoiceId", invoiceId);
    form.set("amount", amount);
    form.set("paidAt", paidAt);
    form.set("paymentMode", mode);
    start(async () => {
      const result = await recordPaymentAction({}, form);
      if (result.error) setError(result.error);
      else setOpen(false);
    });
  }

  return (
    <>
      <Button size="sm" variant="secondary" onClick={openWith}>
        Encaisser
      </Button>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={`Encaissement — ${reference}`}
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Annuler
            </Button>
            <Button variant="primary" disabled={pending} onClick={submit}>
              {pending ? "Enregistrement…" : "Enregistrer"}
            </Button>
          </>
        }
      >
        {error ? (
          <div className="mb-3">
            <Alert tone="danger">{error}</Alert>
          </div>
        ) : null}

        <div className="grid gap-3">
          <Field label="Montant encaissé (MAD)" htmlFor="pay-amount" hint="Reste dû proposé par défaut.">
            <Input
              id="pay-amount"
              type="number"
              min="0.01"
              step="0.01"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
            />
          </Field>

          <Field label="Date d'encaissement" htmlFor="pay-date">
            <Input
              id="pay-date"
              type="date"
              value={paidAt}
              onChange={(event) => setPaidAt(event.target.value)}
            />
          </Field>

          <Field label="Mode de règlement" htmlFor="pay-mode">
            <Select id="pay-mode" value={mode} onChange={(event) => setMode(event.target.value)}>
              <option value="transfer">Virement</option>
              <option value="cheque">Chèque</option>
              <option value="cash">Espèces</option>
              <option value="card">Carte</option>
            </Select>
          </Field>
        </div>
      </Modal>
    </>
  );
}
