"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { Select } from "@/components/ui";

export type ClientOption = { id: string; legalName: string };

/**
 * Filtre par dossier. Il n'y a pas de bouton « Filtrer » : le changement de
 * sélection navigue directement, et l'onglet d'état en cours est conservé
 * dans l'URL — la vue reste donc partageable et rechargeable telle quelle.
 */
export function ClientFilter({ clients }: { clients: ClientOption[] }) {
  const router = useRouter();
  const params = useSearchParams();
  const [pending, start] = useTransition();
  const current = params.get("client") ?? "";

  function change(value: string) {
    const next = new URLSearchParams(params.toString());
    if (value) next.set("client", value);
    else next.delete("client");
    start(() => router.push(`/deadlines?${next.toString()}`));
  }

  return (
    <label className="flex items-center gap-2 text-sm">
      <span className="text-muted whitespace-nowrap">Dossier</span>
      <Select
        aria-label="Filtrer par dossier"
        value={current}
        disabled={pending}
        onChange={(event) => change(event.target.value)}
        className="min-w-56"
      >
        <option value="">Tous les dossiers ({clients.length})</option>
        {clients.map((client) => (
          <option key={client.id} value={client.id}>
            {client.legalName}
          </option>
        ))}
      </Select>
    </label>
  );
}
