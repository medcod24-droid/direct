"use client";

import { useState, useTransition } from "react";
import { assignClientAction, unassignClientAction } from "@/app/actions/app";
import { Alert, Button, Select } from "@/components/ui";

export type AssigneeOption = { id: string; label: string };
export type Assignee = { userId: string; name: string; email: string; role: string };

/**
 * Collaborateurs rattachés à un dossier.
 *
 * C'est ce qui donne son sens à « Dossiers assignés seulement » côté équipe :
 * sans assignation, un collaborateur restreint ne voit aucun dossier.
 */
export function Assignees({
  clientId,
  assignees,
  candidates,
  canAssign,
}: {
  clientId: string;
  assignees: Assignee[];
  candidates: AssigneeOption[];
  canAssign: boolean;
}) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [choice, setChoice] = useState("");

  const assigned = new Set(assignees.map((a) => a.userId));
  const available = candidates.filter((c) => !assigned.has(c.id));

  function run(work: () => Promise<{ error?: string }>) {
    setError(null);
    start(async () => {
      const result = await work();
      if (result.error) setError(result.error);
      else setChoice("");
    });
  }

  return (
    <div className="grid gap-3">
      {error ? <Alert tone="danger">{error}</Alert> : null}

      {assignees.length === 0 ? (
        <p className="text-sm text-muted">
          Aucun collaborateur assigné. Un collaborateur limité à ses dossiers assignés ne verra
          pas celui-ci.
        </p>
      ) : (
        <ul className="divide-y divide-line">
          {assignees.map((assignee) => (
            <li key={assignee.userId} className="flex items-center justify-between gap-3 py-2">
              <div className="min-w-0">
                <div className="text-sm">{assignee.name}</div>
                <div className="text-xs text-muted">{assignee.email}</div>
              </div>
              {canAssign ? (
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={pending}
                  onClick={() => run(() => unassignClientAction(clientId, assignee.userId))}
                >
                  Retirer
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      {canAssign && available.length > 0 ? (
        <div className="flex items-center gap-2">
          <Select
            aria-label="Collaborateur à assigner"
            value={choice}
            disabled={pending}
            onChange={(event) => setChoice(event.target.value)}
            className="min-w-48"
          >
            <option value="">Choisir un collaborateur…</option>
            {available.map((candidate) => (
              <option key={candidate.id} value={candidate.id}>
                {candidate.label}
              </option>
            ))}
          </Select>
          <Button
            variant="secondary"
            disabled={pending || !choice}
            onClick={() => run(() => assignClientAction(clientId, choice))}
          >
            Assigner
          </Button>
        </div>
      ) : null}
    </div>
  );
}
