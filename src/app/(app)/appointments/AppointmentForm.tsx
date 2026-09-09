"use client";

import { useActionState, useState } from "react";
import {
  createAppointmentAction,
  updateAppointmentAction,
  type ActionState,
} from "@/app/actions/app";
import { Alert, Button, Field, Input, Modal, Select, Textarea } from "@/components/ui";
import { wallInputValue } from "@/lib/calendar/month";

export type AppointmentDraft = {
  id: string;
  clientId: string;
  title: string;
  startsAt: Date;
  durationMinutes: number;
  mode: string;
  location: string | null;
  preparation: string | null;
  assignedToId: string | null;
};

export type Option = { id: string; label: string };

const initial: ActionState = {};

export const MODE_LABELS: Record<string, string> = {
  office: "Au cabinet",
  client_site: "Chez le client",
  phone: "Par téléphone",
  video: "Visioconférence",
};

/**
 * Prise et modification d'un rendez-vous.
 *
 * L'heure est saisie et relue telle quelle : un `datetime-local` porte une heure
 * murale, et c'est ainsi qu'elle est enregistrée — sans quoi le même formulaire
 * donnerait deux horaires selon le fuseau de la machine qui l'exécute.
 */
export function AppointmentForm({
  clients,
  staff,
  current,
  defaultDay,
  defaultClientId,
  trigger,
  onDone,
  open: controlledOpen,
  onClose,
}: {
  clients: Option[];
  staff: Option[];
  current?: AppointmentDraft;
  /** Jour pré-sélectionné, au format « 2026-09-15 ». */
  defaultDay?: string;
  defaultClientId?: string;
  trigger?: string;
  onDone?: () => void;
  open?: boolean;
  onClose?: () => void;
}) {
  const [ownOpen, setOwnOpen] = useState(false);
  const open = controlledOpen ?? ownOpen;
  const close = () => {
    setOwnOpen(false);
    onClose?.();
    onDone?.();
  };

  const action = current ? updateAppointmentAction.bind(null, current.id) : createAppointmentAction;
  const [state, formAction, pending] = useActionState(action, initial);

  const value = (name: string, fallback = "") => state.values?.[name] ?? fallback;
  const fieldError = (name: string) => state.fieldErrors?.[name]?.[0];

  const startsAt = current
    ? wallInputValue(current.startsAt)
    : `${defaultDay ?? new Date().toISOString().slice(0, 10)}T09:00`;

  return (
    <>
      {trigger ? (
        <Button variant="primary" size="sm" onClick={() => setOwnOpen(true)}>
          {trigger}
        </Button>
      ) : null}

      <Modal
        open={open}
        onClose={close}
        title={current ? "Modifier le rendez-vous" : "Nouveau rendez-vous"}
        size="lg"
      >
        <form action={formAction} className="grid gap-3">
          {state.error ? <Alert tone="danger">{state.error}</Alert> : null}
          {state.ok ? <Alert tone="success">{state.message}</Alert> : null}

          <Field label="Client attendu" htmlFor="clientId" error={fieldError("clientId")}>
            {current ? (
              <>
                <input type="hidden" name="clientId" value={current.clientId} />
                <Input
                  readOnly
                  value={clients.find((c) => c.id === current.clientId)?.label ?? "—"}
                />
              </>
            ) : (
              <Select
                id="clientId"
                name="clientId"
                required
                defaultValue={value("clientId", defaultClientId ?? "")}
              >
                <option value="">Choisir un dossier…</option>
                {clients.map((client) => (
                  <option key={client.id} value={client.id}>
                    {client.label}
                  </option>
                ))}
              </Select>
            )}
          </Field>

          <Field label="Objet" htmlFor="title" error={fieldError("title")}>
            <Input
              id="title"
              name="title"
              required
              placeholder="Remise des pièces du trimestre"
              defaultValue={value("title", current?.title ?? "")}
            />
          </Field>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Date et heure" htmlFor="startsAt" error={fieldError("startsAt")}>
              <Input
                id="startsAt"
                name="startsAt"
                type="datetime-local"
                required
                defaultValue={value("startsAt", startsAt)}
              />
            </Field>
            <Field label="Durée (minutes)" htmlFor="durationMinutes" error={fieldError("durationMinutes")}>
              <Input
                id="durationMinutes"
                name="durationMinutes"
                type="number"
                min={5}
                max={600}
                step={5}
                defaultValue={value("durationMinutes", String(current?.durationMinutes ?? 30))}
              />
            </Field>
            <Field label="Lieu" htmlFor="mode" error={fieldError("mode")}>
              <Select
                key={value("mode", current?.mode ?? "office")}
                id="mode"
                name="mode"
                defaultValue={value("mode", current?.mode ?? "office")}
              >
                {Object.entries(MODE_LABELS).map(([mode, label]) => (
                  <option key={mode} value={mode}>
                    {label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field
              label="Adresse ou lien"
              htmlFor="location"
              hint="Si le lieu ne va pas de soi."
              error={fieldError("location")}
            >
              <Input
                id="location"
                name="location"
                defaultValue={value("location", current?.location ?? "")}
              />
            </Field>
            <Field label="Reçu par" htmlFor="assignedToId" error={fieldError("assignedToId")}>
              <Select
                key={value("assignedToId", current?.assignedToId ?? "")}
                id="assignedToId"
                name="assignedToId"
                defaultValue={value("assignedToId", current?.assignedToId ?? "")}
              >
                <option value="">—</option>
                {staff.map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.label}
                  </option>
                ))}
              </Select>
            </Field>
          </div>

          <Field
            label="À préparer"
            htmlFor="preparation"
            hint="Ce qu'il faut sortir ou demander avant le rendez-vous."
            error={fieldError("preparation")}
          >
            <Textarea
              id="preparation"
              name="preparation"
              rows={3}
              defaultValue={value("preparation", current?.preparation ?? "")}
            />
          </Field>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={close}>
              {state.ok ? "Fermer" : "Annuler"}
            </Button>
            <Button type="submit" variant="primary" disabled={pending}>
              {pending ? "Enregistrement…" : current ? "Enregistrer" : "Planifier"}
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
