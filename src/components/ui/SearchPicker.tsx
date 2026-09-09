"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { clsx } from "clsx";
import { CONTROL_CLASS } from "./Input";
import { matchRank, matchesTerms, searchTerms } from "@/lib/search";

export type PickerOption = {
  id: string;
  label: string;
  /** Ligne secondaire affichée sous le libellé (ICE, ville…). */
  hint?: string;
  /** Texte normalisé sur lequel porte la recherche. */
  searchKey: string;
};

export type SearchPickerProps = {
  /** Nom du champ envoyé au serveur ; il porte l'identifiant choisi. */
  name: string;
  id?: string;
  options: readonly PickerOption[];
  defaultValue?: string;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  /** Libellé de l'option vide, quand le champ est facultatif. */
  emptyLabel?: string;
  "aria-describedby"?: string;
  "aria-invalid"?: true;
};

const MAX_SHOWN = 40;

/**
 * Choix d'une ligne par la recherche, plutôt que par une liste déroulante.
 *
 * Une liste de cinq cents dossiers ne se parcourt pas : on tape. La recherche
 * porte sur la clé normalisée de chaque ligne — nom, ICE, IF, RC, CIN,
 * téléphone — et les résultats sont classés du plus attendu au moins : taper
 * « M » donne d'abord les dossiers dont le nom **commence** par M, comme dans un
 * annuaire, avant ceux dont seul un numéro correspond.
 *
 * Le champ envoyé au serveur reste un identifiant, dans un `input` caché : la
 * recherche est un confort d'écran, elle ne change rien à ce qui est validé.
 */
export function SearchPicker({
  name,
  id,
  options,
  defaultValue = "",
  placeholder = "Rechercher…",
  required = false,
  disabled = false,
  emptyLabel,
  ...aria
}: SearchPickerProps) {
  const selected = options.find((option) => option.id === defaultValue);
  const [value, setValue] = useState(defaultValue);
  const [query, setQuery] = useState(selected?.label ?? "");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const boxRef = useRef<HTMLDivElement>(null);
  const controlId = id ?? name;

  // Le champ affiche le libellé choisi tant qu'on ne cherche pas.
  const chosen = options.find((option) => option.id === value);

  const results = useMemo(() => {
    const terms = searchTerms(query);
    // La saisie vaut le libellé retenu : on repart de la liste entière plutôt
    // que de ne proposer que la ligne déjà choisie.
    const effective = chosen && query === chosen.label ? [] : terms;
    const matched = effective.length
      ? options.filter((option) => matchesTerms(option.searchKey, effective))
      : [...options];

    return matched
      .map((option) => ({ option, rank: matchRank(option.label, option.searchKey, effective) }))
      .sort((a, b) => a.rank - b.rank || a.option.label.localeCompare(b.option.label, "fr"))
      .slice(0, MAX_SHOWN)
      .map((entry) => entry.option);
  }, [options, query, chosen]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!boxRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [open]);

  const choose = (option: PickerOption | null) => {
    setValue(option?.id ?? "");
    setQuery(option?.label ?? "");
    setOpen(false);
  };

  return (
    <div ref={boxRef} className="relative">
      <input type="hidden" name={name} value={value} />

      <input
        id={controlId}
        type="text"
        role="combobox"
        aria-expanded={open}
        aria-autocomplete="list"
        aria-controls={`${controlId}-list`}
        autoComplete="off"
        disabled={disabled}
        // `required` porte sur la sélection, pas sur le texte tapé : un champ
        // rempli sans ligne retenue doit être refusé.
        required={required && !value}
        placeholder={placeholder}
        value={query}
        className={clsx(CONTROL_CLASS, "h-9")}
        onChange={(event) => {
          setQuery(event.target.value);
          setValue("");
          setActive(0);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            setOpen(true);
            setActive((current) => {
              const next = event.key === "ArrowDown" ? current + 1 : current - 1;
              const count = results.length;
              if (count === 0) return 0;
              return (next + count) % count;
            });
          } else if (event.key === "Enter" && open) {
            const option = results[active];
            if (option) {
              event.preventDefault();
              choose(option);
            }
          } else if (event.key === "Escape") {
            setOpen(false);
          }
        }}
        {...aria}
      />

      {open ? (
        <ul
          id={`${controlId}-list`}
          role="listbox"
          className="absolute z-30 mt-1 max-h-72 w-full overflow-auto rounded-md border border-line bg-surface py-1 shadow-lg"
        >
          {emptyLabel ? (
            <li>
              <button
                type="button"
                className="w-full px-2.5 py-1.5 text-start text-sm text-muted hover:bg-surface2"
                onClick={() => choose(null)}
              >
                {emptyLabel}
              </button>
            </li>
          ) : null}

          {results.length === 0 ? (
            <li className="px-2.5 py-2 text-sm text-muted">Aucun résultat.</li>
          ) : null}

          {results.map((option, index) => (
            <li key={option.id}>
              <button
                type="button"
                role="option"
                aria-selected={option.id === value}
                className={clsx(
                  "w-full px-2.5 py-1.5 text-start text-sm",
                  index === active ? "bg-surface2" : "hover:bg-surface2",
                  option.id === value && "text-accent",
                )}
                onMouseEnter={() => setActive(index)}
                onClick={() => choose(option)}
              >
                <span className="block truncate">{option.label}</span>
                {option.hint ? (
                  <span className="block truncate text-xs text-muted">{option.hint}</span>
                ) : null}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
