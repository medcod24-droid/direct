"use client";

import { useState } from "react";
import { Button, Field, Input } from "@/components/ui";

type TaxRow = { id: number; value: string };
type BranchRow = { id: number; number: string; court: string; taxProfNos: TaxRow[] };
type RegistrationRow = { id: number; number: string; court: string; taxProfNos: TaxRow[]; branches: BranchRow[] };

export type RegistrationsProps = {
  /** Valeur enregistrée ou ressaisie, par nom complet de champ. */
  value: (name: string, fallback?: string) => string;
  fieldError: (name: string) => string | undefined;
};

let nextId = 0;
const id = () => (nextId += 1);

const MAX_REGISTRATIONS = 20;
const MAX_BRANCHES = 20;
const MAX_TAXES = 20;

/**
 * Immatriculations au registre de commerce, avec leurs établissements et leurs
 * numéros de taxe professionnelle.
 *
 * L'imbrication n'est pas une commodité d'écran, elle reproduit le droit. Un
 * commerçant n'a qu'une immatriculation **principale** (code de commerce,
 * art. 39), mais il en prend une **secondaire** dans chaque ressort où il
 * exploite (art. 38 et 41) ; un établissement ouvert dans le ressort du même
 * tribunal reste rattaché à l'immatriculation existante, d'où les succursales à
 * l'intérieur d'un registre. La taxe professionnelle, elle, est établie au lieu
 * de chaque établissement et son numéro d'identification doit être affiché dans
 * chacun d'eux (loi 47-06, art. 8 et 14) : elle se rattache donc à
 * l'établissement — y compris le principal, faute de quoi un dossier à local
 * unique n'aurait nulle part où inscrire son numéro.
 *
 * Les champs sont contrôlés : à trois niveaux imbriqués, un état React est plus
 * sûr que des valeurs laissées dans le DOM, où l'ajout ou le retrait d'une ligne
 * renumérote tout ce qui suit.
 */
export function Registrations({ value, fieldError }: RegistrationsProps) {
  const [rows, setRows] = useState<RegistrationRow[]>(() => readRegistrations(value));

  const patch = (index: number, change: Partial<RegistrationRow>) =>
    setRows((current) => current.map((row, i) => (i === index ? { ...row, ...change } : row)));

  return (
    <div className="grid gap-3">
      <input type="hidden" name="registrations.count" value={rows.length} />

      {rows.length === 0 ? (
        <p className="text-xs text-muted">Aucune immatriculation enregistrée.</p>
      ) : null}

      {rows.map((registration, index) => {
        const prefix = `registrations.${index}`;
        return (
          <fieldset key={registration.id} className="rounded-md border border-line bg-surface2 p-3">
            <legend className="px-1 text-[13px] font-medium text-ink2">
              {index === 0 ? "Immatriculation principale" : `Immatriculation ${index + 1}`}
            </legend>

            <div className="grid gap-3 sm:grid-cols-2">
              <Field
                label="N° de registre de commerce"
                htmlFor={`${prefix}.number`}
                error={fieldError(`${prefix}.number`)}
              >
                <Input
                  id={`${prefix}.number`}
                  name={`${prefix}.number`}
                  value={registration.number}
                  onChange={(event) => patch(index, { number: event.target.value })}
                />
              </Field>
              <Field
                label="Tribunal"
                htmlFor={`${prefix}.court`}
                error={fieldError(`${prefix}.court`)}
              >
                <Input
                  id={`${prefix}.court`}
                  name={`${prefix}.court`}
                  value={registration.court}
                  onChange={(event) => patch(index, { court: event.target.value })}
                />
              </Field>
            </div>

            <TaxList
              prefix={prefix}
              label="Taxe professionnelle — établissement principal"
              rows={registration.taxProfNos}
              onChange={(taxProfNos) => patch(index, { taxProfNos })}
              fieldError={fieldError}
            />

            <div className="mt-3 grid gap-2 border-t border-line pt-3">
              <p className="text-[13px] font-medium text-ink2">Succursales</p>
              {registration.branches.length === 0 ? (
                <p className="text-xs text-muted">
                  Aucun établissement rattaché à cette immatriculation.
                </p>
              ) : null}
              <input
                type="hidden"
                name={`${prefix}.branches.count`}
                value={registration.branches.length}
              />

              {registration.branches.map((branch, branchIndex) => {
                const branchPrefix = `${prefix}.branches.${branchIndex}`;
                const patchBranch = (change: Partial<BranchRow>) =>
                  patch(index, {
                    branches: registration.branches.map((row, i) =>
                      i === branchIndex ? { ...row, ...change } : row,
                    ),
                  });
                return (
                  <div
                    key={branch.id}
                    className="rounded-md border border-line bg-surface p-3"
                  >
                    <div className="grid gap-3 sm:grid-cols-2">
                      <Field
                        label="N° de succursale"
                        htmlFor={`${branchPrefix}.number`}
                        error={fieldError(`${branchPrefix}.number`)}
                      >
                        <Input
                          id={`${branchPrefix}.number`}
                          name={`${branchPrefix}.number`}
                          value={branch.number}
                          onChange={(event) => patchBranch({ number: event.target.value })}
                        />
                      </Field>
                      <Field
                        label="Tribunal"
                        htmlFor={`${branchPrefix}.court`}
                        error={fieldError(`${branchPrefix}.court`)}
                      >
                        <Input
                          id={`${branchPrefix}.court`}
                          name={`${branchPrefix}.court`}
                          value={branch.court}
                          onChange={(event) => patchBranch({ court: event.target.value })}
                        />
                      </Field>
                    </div>

                    <TaxList
                      prefix={branchPrefix}
                      label="Taxe professionnelle de cette succursale"
                      rows={branch.taxProfNos}
                      onChange={(taxProfNos) => patchBranch({ taxProfNos })}
                      fieldError={fieldError}
                    />

                    <div className="mt-2">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          patch(index, {
                            branches: registration.branches.filter((_, i) => i !== branchIndex),
                          })
                        }
                      >
                        Retirer cette succursale
                      </Button>
                    </div>
                  </div>
                );
              })}

              {registration.branches.length < MAX_BRANCHES ? (
                <div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      patch(index, {
                        branches: [
                          ...registration.branches,
                          { id: id(), number: "", court: "", taxProfNos: [] },
                        ],
                      })
                    }
                  >
                    + Ajouter une succursale
                  </Button>
                </div>
              ) : null}
            </div>

            <div className="mt-3 border-t border-line pt-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setRows((current) => current.filter((_, i) => i !== index))}
              >
                Retirer cette immatriculation
              </Button>
            </div>
          </fieldset>
        );
      })}

      {rows.length < MAX_REGISTRATIONS ? (
        <div>
          <Button
            type="button"
            variant="ghost"
            onClick={() =>
              setRows((current) => [
                ...current,
                { id: id(), number: "", court: "", taxProfNos: [], branches: [] },
              ])
            }
          >
            + Ajouter un registre de commerce
          </Button>
        </div>
      ) : null}
    </div>
  );
}

function TaxList({
  prefix,
  label,
  rows,
  onChange,
  fieldError,
}: {
  prefix: string;
  label: string;
  rows: TaxRow[];
  onChange: (rows: TaxRow[]) => void;
  fieldError: (name: string) => string | undefined;
}) {
  return (
    <div className="mt-3 grid gap-2">
      <p className="text-[13px] font-medium text-ink2">{label}</p>
      <input type="hidden" name={`${prefix}.taxProfNos.count`} value={rows.length} />

      {rows.length === 0 ? <p className="text-xs text-muted">Aucun numéro.</p> : null}

      {rows.map((row, index) => {
        const field = `${prefix}.taxProfNos.${index}.value`;
        return (
          <div key={row.id} className="flex items-end gap-2">
            <Field
              label="Numéro"
              htmlFor={field}
              error={fieldError(field)}
              className="min-w-48 flex-1"
            >
              <Input
                id={field}
                name={field}
                value={row.value}
                onChange={(event) =>
                  onChange(rows.map((r, i) => (i === index ? { ...r, value: event.target.value } : r)))
                }
              />
            </Field>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onChange(rows.filter((_, i) => i !== index))}
            >
              Retirer
            </Button>
          </div>
        );
      })}

      {rows.length < MAX_TAXES ? (
        <div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onChange([...rows, { id: id(), value: "" }])}
          >
            + Ajouter un numéro
          </Button>
        </div>
      ) : null}
    </div>
  );
}

/** État initial : même convention aplatie qu'après un refus du serveur. */
function readRegistrations(value: (name: string, fallback?: string) => string): RegistrationRow[] {
  const count = bounded(value("registrations.count", "0"), MAX_REGISTRATIONS);
  return Array.from({ length: count }, (_, index) => {
    const prefix = `registrations.${index}`;
    const branchCount = bounded(value(`${prefix}.branches.count`, "0"), MAX_BRANCHES);
    return {
      id: id(),
      number: value(`${prefix}.number`),
      court: value(`${prefix}.court`),
      taxProfNos: readTaxes(value, prefix),
      branches: Array.from({ length: branchCount }, (_, branchIndex) => {
        const branchPrefix = `${prefix}.branches.${branchIndex}`;
        return {
          id: id(),
          number: value(`${branchPrefix}.number`),
          court: value(`${branchPrefix}.court`),
          taxProfNos: readTaxes(value, branchPrefix),
        };
      }),
    };
  });
}

function readTaxes(value: (name: string, fallback?: string) => string, prefix: string): TaxRow[] {
  const count = bounded(value(`${prefix}.taxProfNos.count`, "0"), MAX_TAXES);
  return Array.from({ length: count }, (_, index) => ({
    id: id(),
    value: value(`${prefix}.taxProfNos.${index}.value`),
  }));
}

function bounded(raw: string, max: number): number {
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? Math.min(Math.max(Math.trunc(parsed), 0), max) : 0;
}
