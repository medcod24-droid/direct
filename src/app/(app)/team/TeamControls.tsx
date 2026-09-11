"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import {
  addMemberAction,
  removeMemberAction,
  updateMemberAction,
  type ActionState,
} from "@/app/actions/app";
import { Alert, Button, Field, Input, Modal } from "@/components/ui";
import type { Permission } from "@/lib/authz/permissions";
import type { EditableMember } from "@/server/services/members";
import { RightsEditor } from "./RightsEditor";

const initial: ActionState = {};

/**
 * Ajout d'un collaborateur, directement.
 *
 * L'administration crée le compte et choisit un mot de passe initial qu'elle
 * communique de vive voix. Le lien d'invitation a disparu : sans envoi de
 * courriel, il fallait de toute façon le recopier à la main pour le même
 * résultat, et la personne est en général dans le bureau d'à côté.
 */
export function AddMember({ grantable }: { grantable: Permission[] }) {
  const [state, action, pending] = useActionState(addMemberAction, initial);
  const [open, setOpen] = useState(false);
  const fieldError = (name: string) => state.fieldErrors?.[name]?.[0];

  return (
    <>
      <Button variant="primary" iconName="plus" onClick={() => setOpen(true)}>
        Ajouter un collaborateur
      </Button>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Ajouter un collaborateur"
        description="Identité, rôle et droits. Tout reste modifiable ensuite depuis l'équipe."
        size="xl"
      >
        <form action={action} className="grid gap-5">
          {state.error ? <Alert tone="danger">{state.error}</Alert> : null}
          {state.ok ? <Alert tone="success">{state.message}</Alert> : null}

          <section className="grid gap-3">
            <h3 className="text-2xs font-650 uppercase tracking-[0.08em] text-muted">Identité</h3>
            <div className="grid gap-3 md:grid-cols-3">
              <Field label="Nom et prénom" htmlFor="name" error={fieldError("name")}>
                <Input
                  id="name"
                  name="name"
                  required
                  autoFocus
                  defaultValue={state.values?.name ?? ""}
                />
              </Field>
              <Field label="Adresse e-mail" htmlFor="email" error={fieldError("email")}>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  required
                  defaultValue={state.values?.email ?? ""}
                />
              </Field>
              <Field
                label="Mot de passe initial"
                htmlFor="password"
                hint="12 caractères au moins, à lui communiquer."
                error={fieldError("password")}
              >
                <Input id="password" name="password" type="text" required />
              </Field>
            </div>
          </section>

          <RightsEditor grantable={grantable} fieldError={fieldError} />

          <div className="flex justify-end gap-2 border-t border-line pt-3">
            <Button variant="ghost" onClick={() => setOpen(false)}>
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

/** Rôle et droits d'un collaborateur existant, dans la même grille qu'à l'ajout. */
export function EditRights({
  member,
  grantable,
}: {
  member: EditableMember;
  grantable: Permission[];
}) {
  const [state, action, pending] = useActionState(updateMemberAction, initial);
  const [open, setOpen] = useState(false);
  const fieldError = (name: string) => state.fieldErrors?.[name]?.[0];

  // Chaque envoi produit un nouvel état : la fenêtre se ferme à chaque succès,
  // et reste ouverte quand on la rouvre ensuite.
  useEffect(() => {
    if (state.ok) setOpen(false);
  }, [state]);

  return (
    <>
      <Button size="sm" iconName="shield" onClick={() => setOpen(true)}>
        Modifier les droits
      </Button>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={`Rôle et droits de ${member.name}`}
        description="Le changement s'applique dès sa prochaine page. Il est inscrit à l'historique."
        size="xl"
      >
        <form action={action} className="grid gap-4">
          <input type="hidden" name="membershipId" value={member.membershipId} />
          {state.error ? <Alert tone="danger">{state.error}</Alert> : null}

          <RightsEditor
            defaultRole={member.role}
            defaultLabel={member.roleLabel ?? ""}
            defaultPermissions={member.permissions}
            defaultRestricted={member.restrictedToAssigned}
            grantable={grantable}
            fieldError={fieldError}
          />

          <div className="flex justify-end gap-2 border-t border-line pt-3">
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Annuler
            </Button>
            <Button type="submit" variant="primary" disabled={pending}>
              {pending ? "Enregistrement…" : "Enregistrer les droits"}
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}

export function MemberControls({
  member,
  grantable,
  locked,
  lockedReason,
}: {
  member: EditableMember | null;
  grantable: Permission[];
  locked: boolean;
  lockedReason?: string;
}) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  if (locked || !member) {
    return <span className="text-xs text-muted">{lockedReason}</span>;
  }

  return (
    <div className="grid gap-1.5">
      <div className="flex flex-wrap items-center gap-2">
        <EditRights member={member} grantable={grantable} />

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
                  const result = await removeMemberAction(member.membershipId);
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
          <strong>{member.name}</strong> perdra immédiatement l&apos;accès au cabinet, à ses dossiers
          et à ses documents.
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
