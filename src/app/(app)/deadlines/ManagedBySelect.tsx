"use client";

import { useTransition } from "react";
import { setDeadlineManagedByAction } from "@/app/actions/app";
import { Select } from "@/components/ui";

/**
 * Qui prend en charge l'échéance.
 *
 * Le bandeau de la page annonce que ce qui est géré par le client ou par un
 * tiers n'est jamais compté en retard pour le cabinet : encore faut-il pouvoir
 * le déclarer. Sans ce sélecteur, toute échéance restait « Cabinet » et gonflait
 * le compteur de retards.
 */
export function ManagedBySelect({
  id,
  managedBy,
}: {
  id: string;
  managedBy: string;
}) {
  const [pending, start] = useTransition();

  return (
    <Select
      aria-label="Géré par"
      value={managedBy}
      disabled={pending}
      onChange={(event) =>
        start(() =>
          setDeadlineManagedByAction(
            id,
            event.target.value as "cabinet" | "client" | "third_party",
          ).then(() => undefined),
        )
      }
      className="h-7 min-w-24 text-xs"
    >
      <option value="cabinet">Cabinet</option>
      <option value="client">Client</option>
      <option value="third_party">Tiers</option>
    </Select>
  );
}
