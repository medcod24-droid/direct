"use client";

import { useEffect, useRef } from "react";
import { Icon } from "@/components/ui";

/**
 * Recherche globale de la barre supérieure.
 *
 * Elle mène à la liste des dossiers, qui cherche sur la clé normalisée : nom,
 * ICE, IF, RC, CIN, téléphone. C'est un vrai formulaire, pas un ornement.
 *
 * L'indice `⌘K` n'est affiché que parce que le raccourci existe : annoncer une
 * touche qui ne fait rien est pire que ne rien annoncer.
 */
export function AppSearch({ defaultValue = "" }: { defaultValue?: string }) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  return (
    <form
      action="/clients"
      method="get"
      role="search"
      className="flex h-[38px] w-full max-w-[420px] items-center gap-2.5 rounded-control border border-line bg-bg px-2.5 text-sm text-muted focus-within:border-accent focus-within:ring-2 focus-within:ring-accentSoft"
    >
      <Icon name="search" size={18} />
      <input
        ref={inputRef}
        type="search"
        name="q"
        defaultValue={defaultValue}
        placeholder="Rechercher un client, un ICE, un RC…"
        aria-label="Rechercher un dossier"
        className="min-w-0 flex-1 bg-transparent text-ink outline-none placeholder:text-muted"
      />
      <kbd className="hidden rounded-md border border-line bg-surface2 px-1.5 py-0.5 text-[11px] font-semibold text-ink2 sm:inline">
        ⌘K
      </kbd>
    </form>
  );
}
