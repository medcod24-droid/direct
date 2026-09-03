"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { Button, Input, Select } from "@/components/ui";

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

/**
 * Recherche texte. Formulaire GET classique : la requête vit dans l'URL, donc la vue
 * reste partageable et le bouton « précédent » du navigateur fonctionne.
 * L'onglet d'état et le dossier en cours sont réémis en champs cachés.
 */
export function DeadlineSearch() {
  const params = useSearchParams();
  const q = params.get("q") ?? "";
  const status = params.get("status");
  const client = params.get("client");

  return (
    <form action="/deadlines" method="get" className="flex items-center gap-2">
      {status ? <input type="hidden" name="status" value={status} /> : null}
      {client ? <input type="hidden" name="client" value={client} /> : null}
      <Input
        type="search"
        name="q"
        defaultValue={q}
        placeholder="Dossier, ICE, obligation…"
        aria-label="Rechercher une échéance"
        className="min-w-64"
      />
      <Button type="submit" variant="secondary">
        Rechercher
      </Button>
      {q ? (
        <a
          href={`/deadlines${status || client ? "?" : ""}${new URLSearchParams({
            ...(status ? { status } : {}),
            ...(client ? { client } : {}),
          }).toString()}`}
          className="text-sm text-muted hover:underline underline-offset-2"
        >
          Effacer
        </a>
      ) : null}
    </form>
  );
}
