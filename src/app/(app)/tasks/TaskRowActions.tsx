"use client";

import { useTransition } from "react";
import { updateTaskStatusAction } from "@/app/actions/app";
import { Button } from "@/components/ui";

/** Clôture d'une tâche depuis la liste, sans passer par un écran de détail. */
export function CompleteTaskButton({ id }: { id: string }) {
  const [pending, start] = useTransition();

  return (
    <Button
      size="sm"
      variant="ghost"
      disabled={pending}
      onClick={() => start(() => updateTaskStatusAction(id, "done").then(() => undefined))}
    >
      {pending ? "…" : "Terminer"}
    </Button>
  );
}
