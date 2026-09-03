"use client";

import { useActionState, useState } from "react";
import { createTaskAction, type ActionState } from "@/app/actions/app";
import { Alert, Button, Card, Field, Input, Select, Textarea } from "@/components/ui";

const initial: ActionState = {};

export type TaskFormOption = { id: string; label: string };

/**
 * Création d'une tâche.
 *
 * Le formulaire reste replié tant qu'on ne s'en sert pas : la page sert d'abord
 * à consulter ce qui reste à faire. Priorité et échéance sont côte à côte, parce
 * qu'une tâche urgente sans date ne remonte nulle part au bon moment.
 */
export function NewTaskForm({
  clients,
  members,
}: {
  clients: TaskFormOption[];
  members: TaskFormOption[];
}) {
  const [state, action, pending] = useActionState(createTaskAction, initial);
  const [open, setOpen] = useState(false);
  const kept = (name: string, fallback = "") => state.values?.[name] ?? fallback;
  const fieldError = (name: string) => state.fieldErrors?.[name]?.[0];

  // Un refus rouvre le formulaire : sinon l'erreur s'afficherait sur un panneau replié.
  const expanded = open || Boolean(state.error);

  if (!expanded) {
    return (
      <div className="flex items-center gap-3">
        <Button onClick={() => setOpen(true)}>Nouvelle tâche</Button>
        {state.ok ? <span className="text-sm text-muted">{state.message}</span> : null}
      </div>
    );
  }

  return (
    <Card title="Nouvelle tâche">
      <form action={action} className="grid gap-3">
        {state.error ? <Alert tone="danger">{state.error}</Alert> : null}

        <Field label="Intitulé" htmlFor="title" error={fieldError("title")}>
          <Input
            id="title"
            name="title"
            required
            autoFocus
            defaultValue={kept("title")}
            placeholder="Préparer l'attestation de régularité fiscale"
          />
        </Field>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Priorité" htmlFor="priority" error={fieldError("priority")}>
            <Select key={kept("priority", "normal")} id="priority" name="priority" defaultValue={kept("priority", "normal")}>
              <option value="low">Basse</option>
              <option value="normal">Normale</option>
              <option value="high">Haute</option>
              <option value="urgent">Urgente</option>
            </Select>
          </Field>

          <Field
            label="À faire avant le"
            htmlFor="dueDate"
            hint="Sans date, la tâche ne remonte pas au tableau de bord."
            error={fieldError("dueDate")}
          >
            <Input id="dueDate" name="dueDate" type="date" defaultValue={kept("dueDate")} />
          </Field>

          <Field label="Dossier" htmlFor="clientId" optional error={fieldError("clientId")}>
            <Select key={kept("clientId")} id="clientId" name="clientId" defaultValue={kept("clientId")}>
              <option value="">Tâche interne au cabinet</option>
              {clients.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.label}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Assignée à" htmlFor="assigneeId" optional error={fieldError("assigneeId")}>
            <Select key={kept("assigneeId")} id="assigneeId" name="assigneeId" defaultValue={kept("assigneeId")}>
              <option value="">Personne</option>
              {members.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.label}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <Field label="Détail" htmlFor="description" optional error={fieldError("description")}>
          <Textarea id="description" name="description" rows={3} defaultValue={kept("description")} />
        </Field>

        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
            Annuler
          </Button>
          <Button type="submit" variant="primary" disabled={pending}>
            {pending ? "Création…" : "Créer la tâche"}
          </Button>
        </div>
      </form>
    </Card>
  );
}
