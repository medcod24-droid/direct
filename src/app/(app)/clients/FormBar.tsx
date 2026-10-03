"use client";

import { useEffect, useRef } from "react";
import type { ActionState } from "@/app/actions/app";
import { Button, Icon } from "@/components/ui";

/**
 * Barre d'enregistrement d'un formulaire long.
 *
 * La fiche client fait plusieurs écrans de haut. L'alerte d'erreur, placée en
 * tête de formulaire, s'affichait à près de trois mille pixels au-dessus du
 * bouton : on enregistrait, rien ne bougeait à l'écran, et on ne savait pas si
 * le dossier était pris. La barre colle au bas de la fenêtre — le message est
 * donc toujours là où l'on vient de cliquer — et le premier champ refusé est
 * amené sous les yeux, puis reçoit le curseur.
 */
export function FormBar({
  state,
  pending,
  submitLabel,
  pendingLabel,
  cancelHref,
}: {
  state: ActionState;
  pending: boolean;
  submitLabel: string;
  pendingLabel: string;
  /** Bouton d'abandon, quand la saisie peut être quittée sans rien perdre. */
  cancelHref?: string;
}) {
  const handled = useRef<ActionState | null>(null);

  useEffect(() => {
    if (state === handled.current) return;
    handled.current = state;
    if (!state.fieldErrors) return;

    // `aria-invalid` est posé par `Field` sur le contrôle lui-même : c'est le
    // premier champ refusé dans l'ordre du formulaire, pas le premier message.
    const field = document.querySelector<HTMLElement>('[aria-invalid="true"]');
    if (!field) return;
    field.scrollIntoView({ block: "center", behavior: "smooth" });
    field.focus({ preventScroll: true });
  }, [state]);

  return (
    <div className="sticky bottom-0 z-20 flex flex-wrap items-center gap-3 rounded-card border border-line bg-surface/95 px-4 py-3 shadow-panel backdrop-blur">
      <p className="mr-auto min-w-0 text-sm" aria-live="polite">
        {pending ? (
          <span className="text-muted">Enregistrement en cours…</span>
        ) : state.error ? (
          <span className="flex items-center gap-1.5 text-danger">
            <Icon name="alert" size={16} />
            {state.error}
          </span>
        ) : state.ok ? (
          <span className="flex items-center gap-1.5 text-ok">
            <Icon name="check" size={16} />
            {state.message ?? "Enregistré."}
          </span>
        ) : null}
      </p>

      {cancelHref ? (
        <Button href={cancelHref} variant="ghost">
          Annuler
        </Button>
      ) : null}
      <Button type="submit" variant="primary" disabled={pending}>
        {pending ? pendingLabel : submitLabel}
      </Button>
    </div>
  );
}
