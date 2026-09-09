"use client";

import Link from "next/link";
import { useActionState, useState, useTransition } from "react";
import {
  completeAppointmentAction,
  deleteAppointmentAction,
  setAppointmentStatusAction,
  type ActionState,
} from "@/app/actions/app";
import { Alert, Badge, Button, Field, Input, Modal, Textarea } from "@/components/ui";
import { endOf, wallDateLong, wallTime } from "@/lib/calendar/month";
import { AppointmentForm, MODE_LABELS, type AppointmentDraft, type Option } from "./AppointmentForm";

export type AppointmentItem = AppointmentDraft & {
  status: string;
  outcome: string | null;
  client: { id: string; legalName: string };
  assignedTo: { id: string; name: string } | null;
};

const STATUS_LABELS: Record<string, string> = {
  scheduled: "Prévu",
  done: "Validé",
  cancelled: "Annulé",
  no_show: "Client absent",
};

const STATUS_TONES: Record<string, "neutral" | "accent" | "red" | "amber" | "green"> = {
  scheduled: "accent",
  done: "green",
  cancelled: "neutral",
  no_show: "red",
};

/**
 * Une ligne de rendez-vous, avec ce qu'on en fait.
 *
 * Un rendez-vous passé et resté « prévu » est signalé : il attend sa validation.
 * Sans ce rappel, un rendez-vous honoré mais jamais validé disparaîtrait dans le
 * passé du calendrier et son compte rendu ne serait jamais écrit.
 */
export function AppointmentCard({
  appointment,
  clients,
  staff,
  canManage,
  now,
}: {
  appointment: AppointmentItem;
  clients: Option[];
  staff: Option[];
  canManage: boolean;
  now: number;
}) {
  const [editing, setEditing] = useState(false);
  const [completing, setCompleting] = useState(false);
  const overdue =
    appointment.status === "scheduled" && endOf(appointment.startsAt, appointment.durationMinutes).getTime() < now;

  return (
    <div
      className={
        "rounded-md border p-3 " +
        (overdue ? "border-warn bg-surface2" : "border-line bg-surface")
      }
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="tabular text-sm font-medium">
              {wallTime(appointment.startsAt)} –{" "}
              {wallTime(endOf(appointment.startsAt, appointment.durationMinutes))}
            </span>
            <Badge tone={STATUS_TONES[appointment.status] ?? "neutral"}>
              {STATUS_LABELS[appointment.status] ?? appointment.status}
            </Badge>
            {overdue ? <Badge tone="amber">À valider</Badge> : null}
          </div>
          <div className="mt-1 text-sm">{appointment.title}</div>
          <div className="text-xs text-muted">
            <Link href={`/clients/${appointment.client.id}`} className="underline underline-offset-2">
              {appointment.client.legalName}
            </Link>
            {" · "}
            {MODE_LABELS[appointment.mode] ?? appointment.mode}
            {appointment.location ? ` · ${appointment.location}` : ""}
            {appointment.assignedTo ? ` · reçu par ${appointment.assignedTo.name}` : ""}
          </div>
          {appointment.preparation ? (
            <p className="mt-1 whitespace-pre-line text-xs text-ink2">
              À préparer : {appointment.preparation}
            </p>
          ) : null}
          {appointment.outcome ? (
            <p className="mt-1 whitespace-pre-line text-xs text-ink2">
              Compte rendu : {appointment.outcome}
            </p>
          ) : null}
        </div>

        {canManage ? (
          <div className="flex shrink-0 flex-wrap gap-1">
            {appointment.status === "scheduled" ? (
              <Button variant="primary" size="sm" onClick={() => setCompleting(true)}>
                Valider
              </Button>
            ) : null}
            {appointment.status !== "done" ? (
              <>
                <Button variant="ghost" size="sm" onClick={() => setEditing(true)}>
                  Modifier
                </Button>
                <StatusButton
                  appointmentId={appointment.id}
                  status="no_show"
                  label="Absent"
                  hidden={appointment.status === "no_show"}
                />
                <StatusButton
                  appointmentId={appointment.id}
                  status="cancelled"
                  label="Annuler"
                  hidden={appointment.status === "cancelled"}
                />
                <DeleteAppointment appointmentId={appointment.id} title={appointment.title} />
              </>
            ) : null}
          </div>
        ) : null}
      </div>

      {editing ? (
        <AppointmentForm
          clients={clients}
          staff={staff}
          current={appointment}
          open
          onClose={() => setEditing(false)}
        />
      ) : null}

      {completing ? (
        <CompleteAppointment
          appointment={appointment}
          onClose={() => setCompleting(false)}
        />
      ) : null}
    </div>
  );
}

const initial: ActionState = {};

/**
 * Validation d'un rendez-vous honoré.
 *
 * Le compte rendu est exigé : c'est lui qui part dans la liste d'activité du
 * client, et une ligne sans contenu n'y apprendrait rien à personne.
 */
function CompleteAppointment({
  appointment,
  onClose,
}: {
  appointment: AppointmentItem;
  onClose: () => void;
}) {
  const action = completeAppointmentAction.bind(null, appointment.id);
  const [state, formAction, pending] = useActionState(action, initial);

  return (
    <Modal open onClose={onClose} title="Valider le rendez-vous" size="lg">
      <p className="text-sm text-muted">
        {appointment.client.legalName} — {wallDateLong(appointment.startsAt)} à{" "}
        {wallTime(appointment.startsAt)}
      </p>

      <form action={formAction} className="mt-3 grid gap-3">
        <input type="hidden" name="clientId" value={appointment.client.id} />
        {state.error ? <Alert tone="danger">{state.error}</Alert> : null}
        {state.ok ? <Alert tone="success">{state.message}</Alert> : null}

        <Field
          label="Motif"
          htmlFor="reason"
          hint="Colonne « Motif » de la liste d'activité."
          error={state.fieldErrors?.reason?.[0]}
        >
          <Input id="reason" name="reason" defaultValue={state.values?.reason ?? "Rendez-vous"} />
        </Field>

        <Field
          label="Compte rendu"
          htmlFor="outcome"
          hint="Ce qui a été fait pendant le rendez-vous. Il sera ajouté à la liste d'activité du client."
          error={state.fieldErrors?.outcome?.[0]}
        >
          <Textarea
            id="outcome"
            name="outcome"
            rows={5}
            required
            autoFocus
            defaultValue={state.values?.outcome ?? ""}
          />
        </Field>

        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            {state.ok ? "Fermer" : "Annuler"}
          </Button>
          <Button type="submit" variant="primary" disabled={pending}>
            {pending ? "Validation…" : "Valider et enregistrer"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function StatusButton({
  appointmentId,
  status,
  label,
  hidden,
}: {
  appointmentId: string;
  status: "cancelled" | "no_show";
  label: string;
  hidden: boolean;
}) {
  const [pending, startTransition] = useTransition();
  if (hidden) return null;

  return (
    <Button
      variant="ghost"
      size="sm"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          await setAppointmentStatusAction(appointmentId, status);
        })
      }
    >
      {pending ? "…" : label}
    </Button>
  );
}

/** Suppression définitive, après confirmation : un rendez-vous annulé reste au calendrier. */
function DeleteAppointment({ appointmentId, title }: { appointmentId: string; title: string }) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [pending, startTransition] = useTransition();

  return (
    <>
      <Button variant="ghost" size="sm" onClick={() => setOpen(true)}>
        Supprimer
      </Button>
      <Modal open={open} onClose={() => setOpen(false)} title="Supprimer ce rendez-vous ?">
        <p className="text-sm">
          « {title} » disparaîtra du calendrier. Pour garder la trace d&apos;un rendez-vous qui
          n&apos;a pas eu lieu, préférez « Annuler » ou « Absent ».
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
                const result = await deleteAppointmentAction(appointmentId);
                if (result.ok) setOpen(false);
                else setError(result.error ?? "Suppression refusée.");
              })
            }
          >
            {pending ? "Suppression…" : "Supprimer"}
          </Button>
        </div>
      </Modal>
    </>
  );
}
