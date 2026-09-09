"use client";

import { useActionState, useState, useTransition } from "react";
import {
  createInterventionAction,
  deleteInterventionAction,
  updateInterventionAction,
  type ActionState,
} from "@/app/actions/app";
import {
  Alert,
  Button,
  EmptyState,
  Field,
  Input,
  Modal,
  Table,
  TBody,
  TD,
  TH,
  THead,
  TR,
  Textarea,
} from "@/components/ui";
import { formatDate } from "@/lib/format";

export type InterventionRow = {
  id: string;
  service: string;
  performedAt: Date;
  reason: string | null;
  report: string | null;
  createdBy: { name: string } | null;
};

const initial: ActionState = {};

/**
 * Liste d'activité : ce que le cabinet a fait pour ce client.
 *
 * Le registre est saisi à la main. Il ne se déduit ni des échéances ni des
 * documents : un rendez-vous, un passage à la DGI, une régularisation ne
 * laissent aucune trace ailleurs, et c'est précisément ce que le comptable veut
 * pouvoir relire — et imprimer avec la fiche.
 */
export function Interventions({
  clientId,
  rows,
  canManage,
}: {
  clientId: string;
  rows: InterventionRow[];
  canManage: boolean;
}) {
  const [editing, setEditing] = useState<InterventionRow | null>(null);
  const [creating, setCreating] = useState(false);

  return (
    <>
      {rows.length === 0 ? (
        <EmptyState
          title="Aucun service enregistré"
          description="Notez ici ce que le cabinet fait pour ce client : la date, le motif, et ce qui en est résulté."
          action={
            canManage ? (
              <Button variant="secondary" size="sm" onClick={() => setCreating(true)}>
                Ajouter une activité
              </Button>
            ) : undefined
          }
        />
      ) : (
        <>
          {canManage ? (
            <div className="mb-3 flex justify-end">
              <Button variant="secondary" size="sm" onClick={() => setCreating(true)}>
                Ajouter une activité
              </Button>
            </div>
          ) : null}

          <Table label="Liste d'activité" minWidth={760}>
            <THead>
              <TR>
                <TH>Service</TH>
                <TH>Date</TH>
                <TH>Motif</TH>
                <TH>Compte rendu</TH>
                {canManage ? <TH>Actions</TH> : null}
              </TR>
            </THead>
            <TBody>
              {rows.map((row) => (
                <TR key={row.id}>
                  <TD>
                    <div>{row.service}</div>
                    {row.createdBy ? (
                      <div className="text-xs text-muted">par {row.createdBy.name}</div>
                    ) : null}
                  </TD>
                  <TD className="tabular whitespace-nowrap align-top">
                    {formatDate(row.performedAt)}
                  </TD>
                  <TD className="align-top">{row.reason ?? "—"}</TD>
                  {/* Le compte rendu est un texte libre : il s'affiche entier, les
                      retours à la ligne compris, plutôt que tronqué. */}
                  <TD className="align-top whitespace-pre-line">{row.report ?? "—"}</TD>
                  {canManage ? (
                    <TD className="align-top">
                      <div className="flex gap-1">
                        <Button variant="ghost" size="sm" onClick={() => setEditing(row)}>
                          Modifier
                        </Button>
                        <DeleteIntervention
                          interventionId={row.id}
                          clientId={clientId}
                          service={row.service}
                        />
                      </div>
                    </TD>
                  ) : null}
                </TR>
              ))}
            </TBody>
          </Table>
        </>
      )}

      {creating ? (
        <InterventionModal clientId={clientId} onClose={() => setCreating(false)} />
      ) : null}
      {editing ? (
        <InterventionModal
          clientId={clientId}
          current={editing}
          onClose={() => setEditing(null)}
        />
      ) : null}
    </>
  );
}

function InterventionModal({
  clientId,
  current,
  onClose,
}: {
  clientId: string;
  current?: InterventionRow;
  onClose: () => void;
}) {
  const action = current
    ? updateInterventionAction.bind(null, current.id)
    : createInterventionAction;
  const [state, formAction, pending] = useActionState(action, initial);

  const value = (name: string, fallback = "") => state.values?.[name] ?? fallback;
  const fieldError = (name: string) => state.fieldErrors?.[name]?.[0];

  return (
    <Modal
      open
      onClose={onClose}
      title={current ? "Modifier l'activité" : "Ajouter une activité"}
      size="lg"
    >
      <form action={formAction} className="grid gap-3">
        <input type="hidden" name="clientId" value={clientId} />
        {state.error ? <Alert tone="danger">{state.error}</Alert> : null}
        {state.ok ? <Alert tone="success">{state.message}</Alert> : null}

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Service" htmlFor="service" error={fieldError("service")}>
            <Input
              id="service"
              name="service"
              required
              autoFocus
              placeholder="Dépôt de la TVA du trimestre"
              defaultValue={value("service", current?.service ?? "")}
            />
          </Field>
          <Field label="Date" htmlFor="performedAt" error={fieldError("performedAt")}>
            <Input
              id="performedAt"
              name="performedAt"
              type="date"
              required
              defaultValue={value(
                "performedAt",
                (current?.performedAt ?? new Date()).toISOString().slice(0, 10),
              )}
            />
          </Field>
        </div>

        <Field
          label="Motif"
          htmlFor="reason"
          hint="Pourquoi ce service a été rendu."
          error={fieldError("reason")}
        >
          <Input
            id="reason"
            name="reason"
            placeholder="Échéance trimestrielle"
            defaultValue={value("reason", current?.reason ?? "")}
          />
        </Field>

        <Field
          label="Compte rendu"
          htmlFor="report"
          hint="Ce qui a été fait, et ce qu'il en est résulté."
          error={fieldError("report")}
        >
          <Textarea
            id="report"
            name="report"
            rows={5}
            defaultValue={value("report", current?.report ?? "")}
          />
        </Field>

        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            {state.ok ? "Fermer" : "Annuler"}
          </Button>
          <Button type="submit" variant="primary" disabled={pending}>
            {pending ? "Enregistrement…" : current ? "Enregistrer" : "Ajouter"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

/**
 * Retrait d'une ligne, après confirmation.
 *
 * Un compte rendu est saisi à la main et ne se retrouve nulle part ailleurs :
 * une suppression par erreur est définitive, elle demande donc un second geste.
 */
function DeleteIntervention({
  interventionId,
  clientId,
  service,
}: {
  interventionId: string;
  clientId: string;
  service: string;
}) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [pending, startTransition] = useTransition();

  return (
    <>
      <Button variant="ghost" size="sm" onClick={() => setOpen(true)}>
        Retirer
      </Button>
      <Modal open={open} onClose={() => setOpen(false)} title="Retirer cette activité ?">
        <p className="text-sm">
          « {service} » sera supprimée de la liste d&apos;activité. Le compte rendu
          n&apos;existe nulle part ailleurs.
        </p>
        {error ? (
          <Alert tone="danger" className="mt-3">
            {error}
          </Alert>
        ) : null}
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Annuler
          </Button>
          <Button
            variant="danger"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                const result = await deleteInterventionAction(interventionId, clientId);
                if (result.ok) setOpen(false);
                else setError(result.error ?? "Suppression refusée.");
              })
            }
          >
            {pending ? "Suppression…" : "Retirer"}
          </Button>
        </div>
      </Modal>
    </>
  );
}
