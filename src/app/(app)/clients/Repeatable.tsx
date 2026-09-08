"use client";

import { useState } from "react";
import { Button, Field, Input, Select } from "@/components/ui";

export type RepeatableColumn = {
  /** Suffixe du nom : le champ est envoyé sous `<name>.<index>.<key>`. */
  key: string;
  label: string;
  placeholder?: string;
  /** Liste fermée plutôt qu'une saisie libre. */
  options?: readonly (readonly [string, string])[];
  className?: string;
};

export type RepeatableProps = {
  /** Préfixe des champs et du compteur (`<name>.count`). */
  name: string;
  columns: readonly RepeatableColumn[];
  /** Valeur enregistrée ou ressaisie, par nom complet de champ. */
  value: (name: string, fallback?: string) => string;
  fieldError: (name: string) => string | undefined;
  addLabel: string;
  emptyLabel: string;
  /** Nombre maximal de lignes ; au-delà, le bouton d'ajout disparaît. */
  max?: number;
};

let nextId = 0;

/**
 * Groupe de champs répétable : succursales, taxes professionnelles, associés…
 *
 * Les lignes sont numérotées dans le nom des champs (`partners.0.name`) et un
 * champ caché porte leur nombre, ce qui permet à l'action serveur de les relire
 * sans convention implicite, et au formulaire de se repeupler après un refus —
 * `values` ne renvoie qu'une carte plate de chaînes.
 *
 * Chaque ligne garde un identifiant stable comme clé React : à la suppression
 * d'une ligne du milieu, React déplace les champs existants au lieu de les
 * recréer, et la saisie des lignes suivantes n'est pas perdue alors même que
 * leur indice change.
 */
export function Repeatable({
  name,
  columns,
  value,
  fieldError,
  addLabel,
  emptyLabel,
  max = 20,
}: RepeatableProps) {
  const [rows, setRows] = useState<{ id: number; index: number | null }[]>(() => {
    const count = Math.min(Number(value(`${name}.count`, "0")) || 0, max);
    return Array.from({ length: count }, (_, index) => ({ id: nextId++, index }));
  });

  /** Valeur d'origine d'une ligne : `null` pour une ligne ajoutée à l'écran. */
  const initial = (index: number | null, key: string) =>
    index === null ? "" : value(`${name}.${index}.${key}`);

  return (
    <div className="grid gap-2">
      <input type="hidden" name={`${name}.count`} value={rows.length} />

      {rows.length === 0 ? <p className="text-xs text-muted">{emptyLabel}</p> : null}

      {rows.map((row, position) => (
        <div
          key={row.id}
          className="flex flex-wrap items-end gap-2 rounded-md border border-line bg-surface2 p-2"
        >
          {columns.map((column) => {
            const field = `${name}.${position}.${column.key}`;
            const defaultValue = initial(row.index, column.key);
            return (
              <Field
                key={column.key}
                label={column.label}
                htmlFor={field}
                error={fieldError(field)}
                className={column.className ?? "min-w-40 flex-1"}
              >
                {column.options ? (
                  <Select
                    key={defaultValue}
                    id={field}
                    name={field}
                    defaultValue={defaultValue || column.options[0]?.[0]}
                  >
                    {column.options.map(([optionValue, label]) => (
                      <option key={optionValue} value={optionValue}>
                        {label}
                      </option>
                    ))}
                  </Select>
                ) : (
                  <Input
                    id={field}
                    name={field}
                    placeholder={column.placeholder}
                    defaultValue={defaultValue}
                  />
                )}
              </Field>
            );
          })}
          <Button
            type="button"
            variant="ghost"
            onClick={() => setRows((current) => current.filter((item) => item.id !== row.id))}
          >
            Retirer
          </Button>
        </div>
      ))}

      {rows.length < max ? (
        <div>
          <Button
            type="button"
            variant="ghost"
            onClick={() => setRows((current) => [...current, { id: nextId++, index: null }])}
          >
            + {addLabel}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
