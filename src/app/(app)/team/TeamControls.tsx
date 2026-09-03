"use client";

import { useActionState, useState, useTransition } from "react";
import {
  inviteMemberAction,
  removeMemberAction,
  revokeInvitationAction,
  updateMemberAction,
  type ActionState,
} from "@/app/actions/app";
import { Alert, Button, Card, Field, Input, Modal, Select } from "@/components/ui";

const initial: ActionState & { inviteUrl?: string } = {};

/**
 * Invitation d'un collaborateur.
 *
 * L'envoi par courriel n'étant pas branché, le lien est affiché une fois pour
 * que l'administrateur le transmette lui-même. Il n'est plus récupérable ensuite :
 * la base ne garde que l'empreinte du jeton.
 */
export function InviteMember() {
  const [state, action, pending] = useActionState(inviteMemberAction, initial);
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const expanded = open || Boolean(state.error) || Boolean(state.inviteUrl);

  if (!expanded) {
    return <Button onClick={() => setOpen(true)}>Ajouter un collaborateur</Button>;
  }

  return (
    <Card title="Ajouter un collaborateur" className="w-full">
      {state.inviteUrl ? (
        <div className="grid gap-3">
          <Alert tone="success">{state.message}</Alert>
          <Field
            label="Lien d'invitation"
            htmlFor="inviteUrl"
            hint="Valable 7 jours, utilisable une seule fois. Il ne sera plus affiché."
          >
            <div className="flex gap-2">
              <Input id="inviteUrl" readOnly value={state.inviteUrl} className="font-mono text-xs" />
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  navigator.clipboard?.writeText(state.inviteUrl!).then(
                    () => setCopied(true),
                    () => setCopied(false),
                  );
                }}
              >
                {copied ? "Copié" : "Copier"}
              </Button>
            </div>
          </Field>
          <div className="flex justify-end">
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Terminé
            </Button>
          </div>
        </div>
      ) : (
        <form action={action} className="grid gap-3">
          {state.error ? <Alert tone="danger">{state.error}</Alert> : null}

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Adresse e-mail" htmlFor="email" error={state.fieldErrors?.email?.[0]}>
              <Input
                id="email"
                name="email"
                type="email"
                required
                autoFocus
                defaultValue={state.values?.email ?? ""}
              />
            </Field>
            <Field label="Rôle" htmlFor="role" error={state.fieldErrors?.role?.[0]}>
              <Select key={state.values?.role ?? "accountant"} id="role" name="role" defaultValue={state.values?.role ?? "accountant"}>
                <option value="admin">Administrateur</option>
                <option value="accountant">Comptable</option>
                <option value="assistant">Assistant</option>
              </Select>
            </Field>
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="restrictedToAssigned"
              defaultChecked={state.values?.restrictedToAssigned === "on"}
            />
            <span>Limiter aux dossiers qui lui sont assignés</span>
          </label>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Annuler
            </Button>
            <Button type="submit" variant="primary" disabled={pending}>
              {pending ? "Création…" : "Créer l'invitation"}
            </Button>
          </div>
        </form>
      )}
    </Card>
  );
}

/** Rôle et portée d'un collaborateur, modifiables en place. */
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

        {/* Retirer coupe l'accès et ne se défait pas depuis l'application :
            il faut une nouvelle invitation. La confirmation est donc obligatoire. */}
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
          nom dans l&apos;historique. Pour le réintégrer, il faudra lui envoyer une nouvelle
          invitation.
        </p>
      </Modal>
    </div>
  );
}

/** Annulation d'une invitation encore ouverte. */
export function RevokeInvitation({ id }: { id: string }) {
  const [pending, start] = useTransition();
  return (
    <Button
      size="sm"
      variant="ghost"
      disabled={pending}
      onClick={() => start(() => revokeInvitationAction(id).then(() => undefined))}
    >
      Annuler
    </Button>
  );
}
