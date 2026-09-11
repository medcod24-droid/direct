"use client";

import { useState } from "react";
import { Button, Field, Input } from "@/components/ui";
import { FieldScan, type ScanInfo } from "./FieldScan";

type TaxRow = { key: number; id: string; value: string };
type Establishment = { address: string; authorizationNo: string };
type BranchRow = Establishment & {
  key: number;
  id: string;
  number: string;
  court: string;
  taxProfNos: TaxRow[];
};
type RegistrationRow = Establishment & {
  key: number;
  id: string;
  number: string;
  court: string;
  taxProfNos: TaxRow[];
  branches: BranchRow[];
};

export type RegistrationsProps = {
  /** Valeur enregistrée ou ressaisie, par nom complet de champ. */
  value: (name: string, fallback?: string) => string;
  fieldError: (name: string) => string | undefined;
  /** Dossier concerné ; absent tant qu'il n'est pas créé (pas de justificatif). */
  clientId: string | null;
  scans: Record<string, ScanInfo>;
};

let nextKey = 0;
/** Clé React, locale à la page. */
const key = () => (nextKey += 1);

/**
 * Identifiant persistant d'une ligne, émis ici pour qu'un justificatif puisse
 * être déposé dans la foulée, avant même l'enregistrement de la fiche. Le
 * serveur le réémet s'il manque ou se répète.
 */
const newId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID().slice(0, 8)
    : Math.random().toString(36).slice(2, 10);

const MAX_REGISTRATIONS = 20;
const MAX_BRANCHES = 20;
const MAX_TAXES = 20;

/**
 * Immatriculations au registre de commerce, avec leurs établissements.
 *
 * L'imbrication n'est pas une commodité d'écran, elle reproduit le droit. Un
 * commerçant n'a qu'une immatriculation **principale** (code de commerce,
 * art. 39), mais il en prend une **secondaire** dans chaque ressort où il
 * exploite (art. 38 et 41) ; un établissement ouvert dans le ressort du même
 * tribunal reste rattaché à l'immatriculation existante, d'où les succursales à
 * l'intérieur d'un registre.
 *
 * Chaque registre et chaque succursale est un **établissement**, et porte ce qui
 * lui est propre :
 * - son adresse, qui fixe le tribunal du registre et la commune de la patente ;
 * - son numéro de patente — la taxe professionnelle, établie au lieu de chaque
 *   établissement, dont le numéro doit y être affiché (loi 47-06, art. 8 et 14) ;
 * - son numéro d'autorisation, quand l'activité en exige une : l'autorisation
 *   d'exploiter est délivrée par la commune pour un local donné.
 *
 * Un dossier sans registre (profession libérale, par exemple) garde un numéro
 * d'autorisation à part, affiché tant qu'aucun registre n'est saisi ; le premier
 * registre ajouté le reprend.
 *
 * Les champs sont contrôlés : à trois niveaux imbriqués, un état React est plus
 * sûr que des valeurs laissées dans le DOM, où l'ajout ou le retrait d'une ligne
 * renumérote tout ce qui suit.
 */
export function Registrations({ value, fieldError, clientId, scans }: RegistrationsProps) {
  const [rows, setRows] = useState<RegistrationRow[]>(() => readRegistrations(value));
  const [standalone, setStandalone] = useState(() => value("authorizationNo"));

  const patch = (index: number, change: Partial<RegistrationRow>) =>
    setRows((current) => current.map((row, i) => (i === index ? { ...row, ...change } : row)));

  return (
    <div className="grid gap-3">
      <input type="hidden" name="registrations.count" value={rows.length} />

      {rows.length === 0 ? (
        <div className="grid gap-3">
          <p className="text-xs text-muted">Aucune immatriculation enregistrée.</p>
          <Field
            label="N° d'autorisation"
            htmlFor="authorizationNo"
            hint="Activité sans registre de commerce : profession libérale, activité réglementée…"
            error={fieldError("authorizationNo")}
            className="sm:max-w-md"
          >
            <Input
              id="authorizationNo"
              name="authorizationNo"
              value={standalone}
              onChange={(event) => setStandalone(event.target.value)}
            />
            <FieldScan clientId={clientId} fieldKey="authorization" current={scans.authorization} />
          </Field>
        </div>
      ) : null}

      {rows.map((registration, index) => {
        const prefix = `registrations.${index}`;
        return (
          <fieldset key={registration.key} className="rounded-card border border-line bg-surface2 p-3.5">
            <legend className="px-1 text-sm font-650 text-ink2">
              {index === 0 ? "Immatriculation principale" : `Immatriculation ${index + 1}`}
            </legend>

            <input type="hidden" name={`${prefix}.id`} value={registration.id} />
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

            <FieldScan
              clientId={clientId}
              fieldKey={`rc:${registration.id}`}
              current={scans[`rc:${registration.id}`]}
            />

            <EstablishmentFields
              prefix={prefix}
              addressLabel={
                index === 0 ? "Adresse de l'établissement principal" : "Adresse de l'établissement"
              }
              row={registration}
              onChange={(change) => patch(index, change)}
              fieldError={fieldError}
              clientId={clientId}
              scanKey={`auth:${registration.id}`}
              // Pièce d'autorisation déposée quand elle valait pour tout le
              // dossier : elle reste visible sur le premier registre.
              scan={scans[`auth:${registration.id}`] ?? (index === 0 ? scans.authorization : undefined)}
            />

            <TaxList
              prefix={prefix}
              label="N° de patente (taxe professionnelle) — établissement principal"
              rows={registration.taxProfNos}
              onChange={(taxProfNos) => patch(index, { taxProfNos })}
              fieldError={fieldError}
              clientId={clientId}
              scans={scans}
            />

            <div className="mt-3 grid gap-2 border-t border-line pt-3">
              <p className="text-sm font-650 text-ink2">Succursales</p>
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
                    key={branch.key}
                    className="rounded-chip border border-line bg-surface p-3"
                  >
                    <input type="hidden" name={`${branchPrefix}.id`} value={branch.id} />
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

                    <FieldScan
                      clientId={clientId}
                      fieldKey={`branch:${branch.id}`}
                      current={scans[`branch:${branch.id}`]}
                    />

                    <EstablishmentFields
                      prefix={branchPrefix}
                      addressLabel="Adresse de la succursale"
                      row={branch}
                      onChange={patchBranch}
                      fieldError={fieldError}
                      clientId={clientId}
                      scanKey={`auth:${branch.id}`}
                      scan={scans[`auth:${branch.id}`]}
                    />

                    <TaxList
                      prefix={branchPrefix}
                      label="N° de patente (taxe professionnelle) de cette succursale"
                      rows={branch.taxProfNos}
                      onChange={(taxProfNos) => patchBranch({ taxProfNos })}
                      fieldError={fieldError}
                      clientId={clientId}
                      scans={scans}
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
                    iconName="plus"
                    onClick={() =>
                      patch(index, {
                        branches: [
                          ...registration.branches,
                          {
                            key: key(),
                            id: newId(),
                            number: "",
                            court: "",
                            address: "",
                            authorizationNo: "",
                            taxProfNos: [],
                          },
                        ],
                      })
                    }
                  >
                    Ajouter une succursale
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
            iconName="plus"
            onClick={() =>
              setRows((current) => [
                ...current,
                {
                  key: key(),
                  id: newId(),
                  number: "",
                  court: "",
                  address: "",
                  // Le premier registre reprend l'autorisation saisie sans registre.
                  authorizationNo: current.length === 0 ? standalone : "",
                  taxProfNos: [],
                  branches: [],
                },
              ])
            }
          >
            Ajouter un registre de commerce
          </Button>
        </div>
      ) : null}
    </div>
  );
}

/** Adresse et autorisation d'un établissement — registre ou succursale. */
function EstablishmentFields({
  prefix,
  addressLabel,
  row,
  onChange,
  fieldError,
  clientId,
  scanKey,
  scan,
}: {
  prefix: string;
  addressLabel: string;
  row: Establishment;
  onChange: (change: Partial<Establishment>) => void;
  fieldError: (name: string) => string | undefined;
  clientId: string | null;
  scanKey: string;
  scan: ScanInfo | undefined;
}) {
  return (
    <div className="mt-3 grid gap-3 sm:grid-cols-2">
      <Field
        label={addressLabel}
        htmlFor={`${prefix}.address`}
        error={fieldError(`${prefix}.address`)}
        className="sm:col-span-2"
      >
        <Input
          id={`${prefix}.address`}
          name={`${prefix}.address`}
          value={row.address}
          onChange={(event) => onChange({ address: event.target.value })}
        />
      </Field>
      <Field
        label="N° d'autorisation"
        htmlFor={`${prefix}.authorizationNo`}
        hint="Autorisation d'exploiter ce local, si l'activité est réglementée."
        error={fieldError(`${prefix}.authorizationNo`)}
      >
        <Input
          id={`${prefix}.authorizationNo`}
          name={`${prefix}.authorizationNo`}
          value={row.authorizationNo}
          onChange={(event) => onChange({ authorizationNo: event.target.value })}
        />
        <FieldScan clientId={clientId} fieldKey={scanKey} current={scan} />
      </Field>
    </div>
  );
}

function TaxList({
  prefix,
  label,
  rows,
  onChange,
  fieldError,
  clientId,
  scans,
}: {
  prefix: string;
  label: string;
  rows: TaxRow[];
  onChange: (rows: TaxRow[]) => void;
  fieldError: (name: string) => string | undefined;
  clientId: string | null;
  scans: Record<string, ScanInfo>;
}) {
  return (
    <div className="mt-3 grid gap-2">
      <p className="text-sm font-650 text-ink2">{label}</p>
      <input type="hidden" name={`${prefix}.taxProfNos.count`} value={rows.length} />

      {rows.length === 0 ? <p className="text-xs text-muted">Aucun numéro de patente.</p> : null}

      {rows.map((row, index) => {
        const field = `${prefix}.taxProfNos.${index}.value`;
        return (
          <div key={row.key} className="grid gap-1">
            <input type="hidden" name={`${prefix}.taxProfNos.${index}.id`} value={row.id} />
            <div className="flex items-end gap-2">
              <Field
                label="N° de patente"
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
            <FieldScan
              clientId={clientId}
              fieldKey={`tax:${row.id}`}
              current={scans[`tax:${row.id}`]}
            />
          </div>
        );
      })}

      {rows.length < MAX_TAXES ? (
        <div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            iconName="plus"
            onClick={() => onChange([...rows, { key: key(), id: newId(), value: "" }])}
          >
            Ajouter un numéro de patente
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
      key: key(),
      id: value(`${prefix}.id`) || newId(),
      number: value(`${prefix}.number`),
      court: value(`${prefix}.court`),
      address: value(`${prefix}.address`),
      authorizationNo: value(`${prefix}.authorizationNo`),
      taxProfNos: readTaxes(value, prefix),
      branches: Array.from({ length: branchCount }, (_, branchIndex) => {
        const branchPrefix = `${prefix}.branches.${branchIndex}`;
        return {
          key: key(),
          id: value(`${branchPrefix}.id`) || newId(),
          number: value(`${branchPrefix}.number`),
          court: value(`${branchPrefix}.court`),
          address: value(`${branchPrefix}.address`),
          authorizationNo: value(`${branchPrefix}.authorizationNo`),
          taxProfNos: readTaxes(value, branchPrefix),
        };
      }),
    };
  });
}

function readTaxes(value: (name: string, fallback?: string) => string, prefix: string): TaxRow[] {
  const count = bounded(value(`${prefix}.taxProfNos.count`, "0"), MAX_TAXES);
  return Array.from({ length: count }, (_, index) => ({
    key: key(),
    id: value(`${prefix}.taxProfNos.${index}.id`) || newId(),
    value: value(`${prefix}.taxProfNos.${index}.value`),
  }));
}

function bounded(raw: string, max: number): number {
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? Math.min(Math.max(Math.trunc(parsed), 0), max) : 0;
}
