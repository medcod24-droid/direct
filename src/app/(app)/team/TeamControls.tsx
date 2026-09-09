"use client";

import { useActionState, useState, useTransition } from "react";
import {
  addMemberAction,
  removeMemberAction,
  updateMemberAction,
  type ActionState,
} from "@/app/actions/app";
import { Alert, Button, Card, Field, Input, Modal, Select } from "@/components/ui";

const initial: ActionState & { inviteUrl?: string } = {};

/**
 * Ajout d'un collaborateur, directement.
 *
 * L'administration crée le compte et choisit un mot de passe initial qu'elle
 * communique de vive voix. Le lien d'invitation a disparu : sans envoi de
 * courriel, il fallait de toute façon le recopier à la main pour le même
 * résultat, et la personne est en général dans le bureau d'à côté.
 */
export function AddMember() {
  const [state, action, pending] = useActionState(addMemberAction, initial);
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button onClick={() => setOpen(true)}>Ajouter un collaborateur</Button>

      <Modal open={open} onClose={() => setOpen(false)} title="Ajouter un collaborateur" size="lg">
        <form action={action} className="grid gap-3">
          {state.error ? <Alert tone="danger">{state.error}</Alert> : null}
          {state.ok ? <Alert tone="success">{state.message}</Alert> : null}

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Nom et prénom" htmlFor="name" error={state.fieldErrors?.name?.[0]}>
              <Input
                id="name"
                name="name"
                required
                autoFocus
                defaultValue={state.values?.name ?? ""}
              />
            </Field>
            <Field label="Adresse e-mail" htmlFor="email" error={state.fieldErrors?.email?.[0]}>
              <Input
                id="email"
                name="email"
                type="email"
                required
                defaultValue={state.values?.email ?? ""}
              />
            </Field>
          </div>

          <Field
            label="Mot de passe initial"
            htmlFor="password"
            hint="Au moins 12 caractères. Communiquez-le au collaborateur : il pourra le changer."
            error={state.fieldErrors?.password?.[0]}
          >
            <Input id="password" name="password" type="text" required />
          </Field>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Rôle" htmlFor="role" error={state.fieldErrors?.role?.[0]}>
              <Select id="role" name="role" defaultValue={state.values?.role ?? "accountant"}>
                <option value="accountant">Comptable</option>
                <option value="assistant">Assistant</option>
                <option value="admin">Administrateur</option>
              </Select>
            </Field>
            <Field label="Portée" htmlFor="restrictedToAssigned">
              <label className="flex h-9 items-center gap-2 text-sm">
                <input id="restrictedToAssigned" name="restrictedToAssigned" type="checkbox" />
                <span>Dossiers assignés seulement</span>
              </label>
            </Field>
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              {state.ok ? "Fermer" : "Annuler"}
            </Button>
            <Button type="submit" variant="primary" disabled={pending}>
              {pending ? "Création…" : "Créer le compte"}
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
export function MemberControls({
  membershipId,
  name,
  role,
  restrictedToAssigned,
  locked,
  lockedReason,
}: {
  membershipId: string;
  name: string;
  role: string;
  restrictedToAssigned: boolean;
  locked: boolean;
  lockedReason?: string;
}) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  if (locked) {
    return <span className="text-xs text-muted">{lockedReason}</span>;
  }

  function apply(nextRole: string, nextScope: boolean) {
    setError(null);
    start(async () => {
      const result = await updateMemberAction(membershipId, nextRole, nextScope);
      if (result.error) setError(result.error);
    });
  }

  return (
    <div className="grid gap-1.5">
      <div className="flex flex-wrap items-center gap-2">
        <Select
          aria-label="Rôle"
          value={role}
          disabled={pending}
          onChange={(event) => apply(event.target.value, restrictedToAssigned)}
          className="h-8 min-w-40 text-[13px]"
        >
          <option value="admin">Administrateur</option>
          <option value="accountant">Comptable</option>
          <option value="assistant">Assistant</option>
        </Select>

        <label className="flex items-center gap-1.5 whitespace-nowrap text-xs text-ink2">
          <input
            type="checkbox"
            checked={restrictedToAssigned}
            disabled={pending}
            onChange={(event) => apply(role, event.target.checked)}
          />
          Dossiers assignés seulement
        </label>

        {/* Retirer coupe l'accès immédiatement : la confirmation est obligatoire,
            un clic malheureux mettrait un collaborateur dehors en pleine journée. */}
        <Button size="sm" variant="ghost" disabled={pending} onClick={() => setConfirming(true)}>
          Retirer
        </Button>
      </div>
      {error ? <span className="text-xs text-danger">{error}</span> : null}

      <Modal
        open={confirming}
        onClose={() => setConfirming(false)}
        title="Retirer ce collaborateur ?"
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
                  const result = await removeMemberAction(membershipId);
                  if (result.error) setError(result.error);
                  setConfirming(false);
                });
              }}
            >
              {pending ? "Retrait…" : "Retirer définitivement"}
            </Button>
          </>
        }
      >
        <p>
          <strong>{name}</strong> perdra immédiatement l&apos;accès au cabinet, à ses dossiers et
          à ses documents.
        </p>
        <p className="mt-2 text-xs text-muted">
          Son compte n&apos;est pas supprimé, et le travail déjà effectué reste attribué à son
          nom dans l&apos;historique. Pour le réintégrer, ajoutez-le de nouveau : il retrouvera
          son mot de passe et ses dossiers.
        </p>
      </Modal>
    </div>
  );
}

