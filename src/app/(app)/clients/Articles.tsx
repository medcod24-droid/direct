"use client";

import { useState } from "react";
import { Button, Field, Input, Select } from "@/components/ui";
import { PROPERTY_USAGES } from "@/lib/domain/enums";
import { PROPERTY_USAGE_LABELS } from "@/lib/domain/labels";
import { FieldScan, type ScanInfo } from "./FieldScan";

type ArticleRow = {
  key: number;
  id: string;
  number: string;
  designation: string;
  address: string;
  usage: string;
};

export type ArticlesProps = {
  /** Valeur enregistrée ou ressaisie, par nom complet de champ. */
  value: (name: string, fallback?: string) => string;
  fieldError: (name: string) => string | undefined;
  /** Dossier concerné ; absent tant qu'il n'est pas créé (pas de justificatif). */
  clientId: string | null;
  scans: Record<string, ScanInfo>;
};

let nextKey = 0;
const key = () => (nextKey += 1);

const newId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID().slice(0, 8)
    : Math.random().toString(36).slice(2, 10);

const MAX_ARTICLES = 50;

/**
 * Articles d'imposition d'un particulier : un par bien imposé.
 *
 * Un particulier suivi par le cabinet n'a ni registre de commerce ni taxe
 * professionnelle ; ce qu'il a, ce sont des biens — un appartement, un garage —
 * chacun portant son propre numéro d'article au rôle. L'usage n'est pas une
 * étiquette : la taxe d'habitation n'abat la valeur locative que pour
 * l'habitation principale (loi 47-06, art. 20), un bien donné en location n'y
 * est pas soumis mais produit des revenus fonciers imposables à l'IR, et le
 * secondaire ne bénéficie d'aucun abattement. C'est donc le champ qui décide du
 * traitement du bien.
 */
export function Articles({ value, fieldError, clientId, scans }: ArticlesProps) {
  const [rows, setRows] = useState<ArticleRow[]>(() => readArticles(value));

  const patch = (index: number, change: Partial<ArticleRow>) =>
    setRows((current) => current.map((row, i) => (i === index ? { ...row, ...change } : row)));

  return (
    <div className="grid gap-3">
      <input type="hidden" name="articles.count" value={rows.length} />

      {rows.length === 0 ? <p className="text-xs text-muted">Aucun article enregistré.</p> : null}

      {rows.map((row, index) => {
        const prefix = `articles.${index}`;
        return (
          <fieldset key={row.key} className="rounded-md border border-line bg-surface2 p-3">
            <legend className="px-1 text-[13px] font-medium text-ink2">Article {index + 1}</legend>
            <input type="hidden" name={`${prefix}.id`} value={row.id} />

            <div className="grid gap-3 sm:grid-cols-2">
              <Field
                label="N° d'article"
                htmlFor={`${prefix}.number`}
                error={fieldError(`${prefix}.number`)}
              >
                <Input
                  id={`${prefix}.number`}
                  name={`${prefix}.number`}
                  value={row.number}
                  onChange={(event) => patch(index, { number: event.target.value })}
                />
              </Field>
              <Field
                label="Désignation"
                htmlFor={`${prefix}.designation`}
                hint="Appartement, garage, local…"
                error={fieldError(`${prefix}.designation`)}
              >
                <Input
                  id={`${prefix}.designation`}
                  name={`${prefix}.designation`}
                  value={row.designation}
                  onChange={(event) => patch(index, { designation: event.target.value })}
                />
              </Field>
              <Field
                label="Adresse"
                htmlFor={`${prefix}.address`}
                error={fieldError(`${prefix}.address`)}
                className="sm:col-span-2"
              >
                <Input
                  id={`${prefix}.address`}
                  name={`${prefix}.address`}
                  value={row.address}
                  onChange={(event) => patch(index, { address: event.target.value })}
                />
              </Field>
              <Field
                label="Usage"
                htmlFor={`${prefix}.usage`}
                error={fieldError(`${prefix}.usage`)}
              >
                <Select
                  id={`${prefix}.usage`}
                  name={`${prefix}.usage`}
                  value={row.usage}
                  onChange={(event) => patch(index, { usage: event.target.value })}
                >
                  {PROPERTY_USAGES.map((usage) => (
                    <option key={usage} value={usage}>
                      {PROPERTY_USAGE_LABELS[usage]}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>

            <FieldScan
              clientId={clientId}
              fieldKey={`article:${row.id}`}
              current={scans[`article:${row.id}`]}
            />

            <div className="mt-3 border-t border-line pt-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setRows((current) => current.filter((_, i) => i !== index))}
              >
                Retirer cet article
              </Button>
            </div>
          </fieldset>
        );
      })}

      {rows.length < MAX_ARTICLES ? (
        <div>
          <Button
            type="button"
            variant="ghost"
            onClick={() =>
              setRows((current) => [
                ...current,
                {
                  key: key(),
                  id: newId(),
                  number: "",
                  designation: "",
                  address: "",
                  usage: "principale",
                },
              ])
            }
          >
            + Ajouter un article
          </Button>
        </div>
      ) : null}
    </div>
  );
}

function readArticles(value: (name: string, fallback?: string) => string): ArticleRow[] {
  const declared = Number(value("articles.count", "0"));
  const count = Number.isFinite(declared)
    ? Math.min(Math.max(Math.trunc(declared), 0), MAX_ARTICLES)
    : 0;

  return Array.from({ length: count }, (_, index) => {
    const prefix = `articles.${index}`;
    return {
      key: key(),
      id: value(`${prefix}.id`) || newId(),
      number: value(`${prefix}.number`),
      designation: value(`${prefix}.designation`),
      address: value(`${prefix}.address`),
      usage: value(`${prefix}.usage`, "principale"),
    };
  });
}
