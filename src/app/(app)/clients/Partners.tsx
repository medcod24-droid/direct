"use client";

import { useState } from "react";
import { Button, Field, Input, Select } from "@/components/ui";
import { FieldScan, type ScanInfo } from "./FieldScan";

type PartnerRow = {
  key: number;
  id: string;
  role: string;
  name: string;
  cin: string;
  phone: string;
  address: string;
};

export type PartnersProps = {
  /** Valeur enregistrée ou ressaisie, par nom complet de champ. */
  value: (name: string, fallback?: string) => string;
  fieldError: (name: string) => string | undefined;
  /** Dossier concerné ; absent tant qu'il n'est pas créé (pas de justificatif). */
  clientId: string | null;
  scans: Record<string, ScanInfo>;
  /** Le numéro de CIN n'est saisi qu'en mode CNDP « autorisation ». */
  cinAllowed: boolean;
};

let nextKey = 0;
const key = () => (nextKey += 1);

const newId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID().slice(0, 8)
    : Math.random().toString(36).slice(2, 10);

const MAX_PARTNERS = 30;

/**
 * Gérants et associés de la société.
 *
 * Chacun porte son propre justificatif — copie de CIN, procès-verbal de
 * nomination — d'où un identifiant stable par ligne : un indice de position
 * aurait déplacé la pièce d'un associé sur un autre au premier retrait.
 *
 * La CIN suit le mode CNDP du cabinet, comme partout ailleurs : ce sont des
 * données personnelles de tiers, et la liste des associés ne doit pas devenir la
 * voie par laquelle des numéros entrent malgré le mode « déclaration ».
 */
export function Partners({ value, fieldError, clientId, scans, cinAllowed }: PartnersProps) {
  const [rows, setRows] = useState<PartnerRow[]>(() => readPartners(value));

  const patch = (index: number, change: Partial<PartnerRow>) =>
    setRows((current) => current.map((row, i) => (i === index ? { ...row, ...change } : row)));

  return (
    <div className="grid gap-3">
      <input type="hidden" name="partners.count" value={rows.length} />

      {rows.length === 0 ? (
        <p className="text-xs text-muted">Aucun gérant ni associé enregistré.</p>
      ) : null}

      {rows.map((row, index) => {
        const prefix = `partners.${index}`;
        return (
          <fieldset key={row.key} className="rounded-md border border-line bg-surface2 p-3">
            <legend className="px-1 text-[13px] font-medium text-ink2">
              {row.role === "gerant" ? "Gérant" : "Associé"} {index + 1}
            </legend>
            <input type="hidden" name={`${prefix}.id`} value={row.id} />

            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Qualité" htmlFor={`${prefix}.role`} error={fieldError(`${prefix}.role`)}>
                <Select
                  id={`${prefix}.role`}
                  name={`${prefix}.role`}
                  value={row.role}
                  onChange={(event) => patch(index, { role: event.target.value })}
                >
                  <option value="gerant">Gérant</option>
                  <option value="associe">Associé</option>
                </Select>
              </Field>
              <Field
                label="Nom et prénom"
                htmlFor={`${prefix}.name`}
                error={fieldError(`${prefix}.name`)}
              >
                <Input
                  id={`${prefix}.name`}
                  name={`${prefix}.name`}
                  value={row.name}
                  onChange={(event) => patch(index, { name: event.target.value })}
                />
              </Field>

              {cinAllowed ? (
                <Field label="CIN" htmlFor={`${prefix}.cin`} error={fieldError(`${prefix}.cin`)}>
                  <Input
                    id={`${prefix}.cin`}
                    name={`${prefix}.cin`}
                    value={row.cin}
                    onChange={(event) => patch(index, { cin: event.target.value })}
                  />
                </Field>
              ) : null}

              <Field
                label="Téléphone"
                htmlFor={`${prefix}.phone`}
                error={fieldError(`${prefix}.phone`)}
              >
                <Input
                  id={`${prefix}.phone`}
                  name={`${prefix}.phone`}
                  type="tel"
                  value={row.phone}
                  onChange={(event) => patch(index, { phone: event.target.value })}
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
            </div>

            <FieldScan
              clientId={clientId}
              fieldKey={`partner:${row.id}`}
              current={scans[`partner:${row.id}`]}
            />

            <div className="mt-3 border-t border-line pt-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setRows((current) => current.filter((_, i) => i !== index))}
              >
                Retirer
              </Button>
            </div>
          </fieldset>
        );
      })}

      {rows.length < MAX_PARTNERS ? (
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
                  role: current.length === 0 ? "gerant" : "associe",
                  name: "",
                  cin: "",
                  phone: "",
                  address: "",
                },
              ])
            }
          >
            + Ajouter un gérant ou un associé
          </Button>
        </div>
      ) : null}
    </div>
  );
}

function readPartners(value: (name: string, fallback?: string) => string): PartnerRow[] {
  const declared = Number(value("partners.count", "0"));
  const count = Number.isFinite(declared)
    ? Math.min(Math.max(Math.trunc(declared), 0), MAX_PARTNERS)
    : 0;

  return Array.from({ length: count }, (_, index) => {
    const prefix = `partners.${index}`;
    return {
      key: key(),
      id: value(`${prefix}.id`) || newId(),
      role: value(`${prefix}.role`, "associe"),
      name: value(`${prefix}.name`),
      cin: value(`${prefix}.cin`),
      phone: value(`${prefix}.phone`),
      address: value(`${prefix}.address`),
    };
  });
}
