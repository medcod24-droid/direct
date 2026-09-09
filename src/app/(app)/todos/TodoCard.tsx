"use client";

import Link from "next/link";
import { useActionState, useState, useTransition } from "react";
import {
  approveTodoAction,
  createTodoAction,
  deleteTodoAction,
  returnTodoAction,
  submitTodoAction,
  updateTodoAction,
  type ActionState,
} from "@/app/actions/app";
import {
  Alert,
  Badge,
  Button,
  Field,
  Input,
  Modal,
  SearchPicker,
  Select,
  Textarea,
  type PickerOption,
} from "@/components/ui";
import { PRIORITY_LABELS } from "@/lib/domain/labels";
import { formatDate, formatDateTime, relativeDays } from "@/lib/format";

export type TodoItem = {
  id: string;
  assigneeId: string;
  assigneeName: string;
  title: string;
  details: string | null;
  dueDate: Date | null;
  priority: string;
  status: string;
  submittedNote: string | null;
  submittedAt: Date | null;
  reviewNote: string | null;
  approvedAt: Date | null;
  approvedByName: string | null;
  client: { id: string; legalName: string } | null;
};

/**
 * Trois états, trois couleurs — c'est le cœur du dispositif.
 *
 * Confiée : rien n'est fait. Rendue : le collaborateur a terminé et a laissé une
 * note, mais l'administrateur ne l'a pas encore lue — d'où l'orange, qui dit
 * « en attente », pas « fini ». Confirmée : l'administrateur a lu et clos, et le
 * vert apparaît alors des deux côtés.
 */
const STATUS: Record<string, { label: string; tone: "neutral" | "accent" | "amber" | "green" | "red" }> = {
  assigned: { label: "À faire", tone: "neutral" },
  submitted: { label: "Rendue — à confirmer", tone: "amber" },
  approved: { label: "Confirmée", tone: "green" },
  returned: { label: "Renvoyée", tone: "red" },
};

const initial: ActionState = {};

export function TodoCard({
  todo,
  canManage,
  isMine,
  staff,
  clients,
}: {
  todo: TodoItem;
  canManage: boolean;
  isMine: boolean;
  staff: PickerOption[];
  clients: PickerOption[];
}) {
  const [submitting, setSubmitting] = useState(false);
  const [returning, setReturning] = useState(false);
  const [editing, setEditing] = useState(false);
  const state = STATUS[todo.status] ?? STATUS.assigned;
  const overdue =
    todo.dueDate !== null && todo.status !== "approved" && todo.dueDate.getTime() < Date.now();

  return (
    <div
      className={
        "rounded-md border p-3 " +
        (todo.status === "approved"
          ? "border-ok/40 bg-okSoft/20"
          : todo.status === "submitted"
            ? "border-warn/50 bg-warnSoft/20"
            : todo.status === "returned"
              ? "border-danger/40 bg-dangerSoft/20"
              : "border-line bg-surface")
      }
    >
      <div className="grid gap-2">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={state?.tone ?? "neutral"}>{state?.label}</Badge>
            {todo.priority === "urgent" || todo.priority === "high" ? (
              <Badge tone={todo.priority === "urgent" ? "red" : "amber"}>
                {PRIORITY_LABELS[todo.priority] ?? todo.priority}
              </Badge>
            ) : null}
            {overdue ? <Badge tone="red">En retard</Badge> : null}
          </div>

          <div className="mt-1 text-sm font-medium">{todo.title}</div>
          <div className="text-xs text-muted">
            {canManage ? `${todo.assigneeName} · ` : ""}
            {todo.dueDate ? `à faire pour le ${formatDate(todo.dueDate)} (${relativeDays(todo.dueDate)})` : "sans date"}
            {todo.client ? " · " : ""}
            {todo.client ? (
              <Link href={`/clients/${todo.client.id}`} className="underline underline-offset-2">
                {todo.client.legalName}
              </Link>
            ) : null}
          </div>

          {todo.details ? (
            <p className="mt-1 whitespace-pre-line text-xs text-ink2">{todo.details}</p>
          ) : null}

          {todo.submittedNote ? (
            <p className="mt-2 whitespace-pre-line rounded bg-surface2 p-2 text-xs">
              <span className="text-muted">
                Note du collaborateur
                {todo.submittedAt ? ` — ${formatDateTime(todo.submittedAt)}` : ""} :{" "}
              </span>
              {todo.submittedNote}
            </p>
          ) : null}

          {todo.reviewNote ? (
            <p className="mt-2 whitespace-pre-line rounded bg-surface2 p-2 text-xs">
              <span className="text-muted">Renvoyée par l&apos;administrateur : </span>
              {todo.reviewNote}
            </p>
          ) : null}

          {todo.status === "approved" && todo.approvedAt ? (
            <p className="mt-1 text-xs text-muted">
              Confirmée le {formatDateTime(todo.approvedAt)}
              {todo.approvedByName ? ` par ${todo.approvedByName}` : ""}.
            </p>
          ) : null}
        </div>

        <div className="flex flex-wrap gap-1 border-t border-line pt-2">
          {isMine && todo.status !== "approved" && todo.status !== "submitted" ? (
            <Button variant="primary" size="sm" onClick={() => setSubmitting(true)}>
              Marquer comme faite
            </Button>
          ) : null}

          {canManage && todo.status === "submitted" ? (
            <>
              <ApproveButton todoId={todo.id} />
              <Button variant="ghost" size="sm" onClick={() => setReturning(true)}>
                Renvoyer
              </Button>
            </>
          ) : null}

          {canManage && todo.status !== "approved" ? (
            <>
              <Button variant="ghost" size="sm" onClick={() => setEditing(true)}>
                Modifier
              </Button>
              <DeleteTodo todoId={todo.id} title={todo.title} />
            </>
          ) : null}
        </div>
      </div>

      {submitting ? (
        <NoteModal
          title="Marquer la tâche comme faite"
          description="Dites ce qui a été fait — ou ce qui manque encore. L'administrateur lira cette note avant de confirmer."
          label="Note"
          submitLabel="Rendre la tâche"
          action={submitTodoAction.bind(null, todo.id)}
          onClose={() => setSubmitting(false)}
        />
      ) : null}

      {returning ? (
        <NoteModal
          title="Renvoyer la tâche"
          description="Dites ce qu'il reste à faire. La tâche repart chez le collaborateur."
          label="Motif du renvoi"
          submitLabel="Renvoyer"
          action={returnTodoAction.bind(null, todo.id)}
          onClose={() => setReturning(false)}
        />
      ) : null}

      {editing ? (
        <TodoForm
          staff={staff}
          clients={clients}
          current={todo}
          open
          onClose={() => setEditing(false)}
        />
      ) : null}
    </div>
  );
}

function NoteModal({
  title,
  description,
  label,
  submitLabel,
  action,
  onClose,
}: {
  title: string;
  description: string;
  label: string;
  submitLabel: string;
  action: (prev: ActionState, form: FormData) => Promise<ActionState>;
  onClose: () => void;
}) {
  const [state, formAction, pending] = useActionState(action, initial);

  return (
    <Modal open onClose={onClose} title={title} size="lg">
      <p className="text-sm text-muted">{description}</p>
      <form action={formAction} className="mt-3 grid gap-3">
        {state.error ? <Alert tone="danger">{state.error}</Alert> : null}
        {state.ok ? <Alert tone="success">{state.message}</Alert> : null}

        <Field label={label} htmlFor="note" error={state.fieldErrors?.note?.[0]}>
          <Textarea id="note" name="note" rows={5} required autoFocus defaultValue={state.values?.note ?? ""} />
        </Field>

        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            {state.ok ? "Fermer" : "Annuler"}
          </Button>
          <Button type="submit" variant="primary" disabled={pending}>
            {pending ? "Enregistrement…" : submitLabel}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function ApproveButton({ todoId }: { todoId: string }) {
  const [pending, startTransition] = useTransition();
  return (
    <Button
      variant="primary"
      size="sm"
      disabled={pending}
      onClick={() => startTransition(async () => void (await approveTodoAction(todoId)))}
    >
      {pending ? "…" : "Confirmer"}
    </Button>
  );
}

function DeleteTodo({ todoId, title }: { todoId: string; title: string }) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [pending, startTransition] = useTransition();

  return (
    <>
      <Button variant="ghost" size="sm" onClick={() => setOpen(true)}>
        Retirer
      </Button>
      <Modal open={open} onClose={() => setOpen(false)} title="Retirer cette tâche ?">
        <p className="text-sm">« {title} » disparaîtra de la liste du collaborateur.</p>
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
                const result = await deleteTodoAction(todoId);
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

/** Confie une tâche, ou la modifie. Réservé à l'administration. */
export function TodoForm({
  staff,
  clients,
  current,
  defaultAssigneeId,
  trigger,
  open: controlledOpen,
  onClose,
}: {
  staff: PickerOption[];
  clients: PickerOption[];
  current?: TodoItem;
  defaultAssigneeId?: string;
  trigger?: string;
  open?: boolean;
  onClose?: () => void;
}) {
  const [ownOpen, setOwnOpen] = useState(false);
  const open = controlledOpen ?? ownOpen;
  const close = () => {
    setOwnOpen(false);
    onClose?.();
  };

  const action = current ? updateTodoAction.bind(null, current.id) : createTodoAction;
  const [state, formAction, pending] = useActionState(action, initial);
  const value = (name: string, fallback = "") => state.values?.[name] ?? fallback;

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
        title={current ? "Modifier la tâche" : "Confier une tâche"}
        size="lg"
      >
        <form action={formAction} className="grid gap-3">
          {state.error ? <Alert tone="danger">{state.error}</Alert> : null}
          {state.ok ? <Alert tone="success">{state.message}</Alert> : null}

          <Field label="Collaborateur" htmlFor="assigneeId" error={state.fieldErrors?.assigneeId?.[0]}>
            <SearchPicker
              id="assigneeId"
              name="assigneeId"
              required
              options={staff}
              defaultValue={value("assigneeId", current?.assigneeId ?? defaultAssigneeId ?? "")}
              placeholder="Nom ou e-mail…"
            />
          </Field>

          <Field label="Tâche" htmlFor="title" error={state.fieldErrors?.title?.[0]}>
            <Input
              id="title"
              name="title"
              required
              placeholder="Déposer les déclarations à la DGI"
              defaultValue={value("title", current?.title ?? "")}
            />
          </Field>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="À faire pour le" htmlFor="dueDate" error={state.fieldErrors?.dueDate?.[0]}>
              <Input
                id="dueDate"
                name="dueDate"
                type="date"
                defaultValue={value(
                  "dueDate",
                  current?.dueDate ? current.dueDate.toISOString().slice(0, 10) : "",
                )}
              />
            </Field>
            <Field label="Priorité" htmlFor="priority">
              <Select
                key={value("priority", current?.priority ?? "normal")}
                id="priority"
                name="priority"
                defaultValue={value("priority", current?.priority ?? "normal")}
              >
                <option value="low">Basse</option>
                <option value="normal">Normale</option>
                <option value="high">Haute</option>
                <option value="urgent">Urgente</option>
              </Select>
            </Field>
          </div>

          <Field
            label="Dossier concerné"
            htmlFor="clientId"
            hint="Facultatif : une tâche d'équipe ne vise pas toujours un dossier."
          >
            <SearchPicker
              id="clientId"
              name="clientId"
              options={clients}
              defaultValue={value("clientId", current?.client?.id ?? "")}
              emptyLabel="Aucun dossier"
              placeholder="Nom, ICE, RC…"
            />
          </Field>

          <Field label="Précisions" htmlFor="details">
            <Textarea
              id="details"
              name="details"
              rows={4}
              defaultValue={value("details", current?.details ?? "")}
            />
          </Field>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={close}>
              {state.ok ? "Fermer" : "Annuler"}
            </Button>
            <Button type="submit" variant="primary" disabled={pending}>
              {pending ? "Enregistrement…" : current ? "Enregistrer" : "Confier"}
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
