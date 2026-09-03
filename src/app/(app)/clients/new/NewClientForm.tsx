"use client";

import { useActionState } from "react";
import { createClientAction, type ActionState } from "@/app/actions/app";
import { Alert, Button, Card, Field, Input, Select } from "@/components/ui";

const initial: ActionState = {};

const SUBTYPES = [
  { group: "Personne morale", options: [
    ["sarl", "SARL"], ["sarl_au", "SARL AU"], ["sa", "SA"], ["sas", "SAS"], ["snc", "SNC"],
    ["succursale", "Succursale"], ["gie", "GIE"], ["association", "Association"],
    ["cooperative", "Coopérative"], ["syndic", "Syndic de copropriété"],
  ] },
  { group: "Personne physique", options: [
    ["auto_entrepreneur", "Auto-entrepreneur"], ["cpu", "CPU"], ["rnr", "RNR"], ["rns", "RNS"],
    ["particulier", "Particulier"],
  ] },
] as const;

export function NewClientForm({ cndpMode }: { cndpMode: string }) {
  const [state, action, pending] = useActionState(createClientAction, initial);
  // Message renvoyé par le serveur pour ce champ précis (validation Zod).
  const fieldError = (name: string) => state.fieldErrors?.[name]?.[0];

  return (
    <form action={action} className="grid gap-4">
      {state.error ? <Alert tone="danger">{state.error}</Alert> : null}

      <Card title="Identité">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Raison sociale ou nom" htmlFor="legalName" error={fieldError("legalName")}>
            <Input id="legalName" name="legalName" required autoFocus />
          </Field>
          <Field label="Nom commercial" htmlFor="tradeName" error={fieldError("tradeName")}>
            <Input id="tradeName" name="tradeName" />
          </Field>
          <Field label="Type" htmlFor="kind" error={fieldError("kind")}>
            <Select id="kind" name="kind" defaultValue="company">
              <option value="company">Personne morale</option>
              <option value="individual">Personne physique</option>
            </Select>
          </Field>
          <Field label="Forme" htmlFor="subtype" error={fieldError("subtype")}>
            <Select id="subtype" name="subtype" defaultValue="sarl">
              {SUBTYPES.map((group) => (
                <optgroup key={group.group} label={group.group}>
                  {group.options.map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </optgroup>
              ))}
            </Select>
          </Field>
          <Field label="ICE" htmlFor="ice" hint="15 chiffres" error={fieldError("ice")}>
            <Input id="ice" name="ice" inputMode="numeric" />
          </Field>
          <Field label="Identifiant fiscal" htmlFor="if" error={fieldError("if")}>
            <Input id="if" name="if" inputMode="numeric" />
          </Field>
          <Field label="Registre de commerce" htmlFor="rc" error={fieldError("rc")}>
            <Input id="rc" name="rc" />
          </Field>
          <Field label="Ville" htmlFor="city" error={fieldError("city")}>
            <Input id="city" name="city" />
          </Field>
          <Field label="Téléphone" htmlFor="phone" error={fieldError("phone")}>
            <Input id="phone" name="phone" type="tel" />
          </Field>
          <Field label="E-mail" htmlFor="email" error={fieldError("email")}>
            <Input id="email" name="email" type="email" />
          </Field>
          <Field label="Activité" htmlFor="activity" error={fieldError("activity")}>
            <Input id="activity" name="activity" />
          </Field>
        </div>
        {cndpMode !== "authorization" ? (
          <p className="text-xs text-muted mt-3">
            Mode CNDP « déclaration » : le numéro de CIN du gérant n&apos;est pas enregistré.
            Il pourra l&apos;être après obtention de votre autorisation.
          </p>
        ) : null}
      </Card>

      <Card title="Régime et échéances">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Régime fiscal" htmlFor="taxRegime" error={fieldError("taxRegime")}>
            <Select id="taxRegime" name="taxRegime" defaultValue="is">
              <option value="is">IS</option>
              <option value="rnr">IR — RNR</option>
              <option value="rns">IR — RNS</option>
              <option value="cpu">CPU</option>
              <option value="auto_entrepreneur">Auto-entrepreneur</option>
              <option value="none">Aucun</option>
            </Select>
          </Field>
          <Field label="Régime de TVA" htmlFor="vatRegime" hint="Mensuel dès 1 000 000 MAD de CA taxable" error={fieldError("vatRegime")}>
            <Select id="vatRegime" name="vatRegime" defaultValue="quarterly">
              <option value="quarterly">Trimestriel</option>
              <option value="monthly">Mensuel</option>
              <option value="exempt">Hors champ / exonéré</option>
            </Select>
          </Field>
          <Field label="Clôture — mois" htmlFor="fiscalYearEndMonth" error={fieldError("fiscalYearEndMonth")}>
            <Input id="fiscalYearEndMonth" name="fiscalYearEndMonth" type="number" min={1} max={12} defaultValue={12} />
          </Field>
          <Field label="Clôture — jour" htmlFor="fiscalYearEndDay" error={fieldError("fiscalYearEndDay")}>
            <Input id="fiscalYearEndDay" name="fiscalYearEndDay" type="number" min={1} max={31} defaultValue={31} />
          </Field>
          <Field
            label="Date de prise en charge"
            htmlFor="takeoverDate"
            hint="Aucune échéance ne sera générée avant cette date."
           error={fieldError("takeoverDate")}>
            <Input
              id="takeoverDate"
              name="takeoverDate"
              type="date"
              required
              defaultValue={new Date().toISOString().slice(0, 10)}
            />
          </Field>
          <Field label="Employeur (CNSS)" htmlFor="isEmployer" error={fieldError("isEmployer")}>
            <label className="flex items-center gap-2 text-sm h-9">
              <input id="isEmployer" name="isEmployer" type="checkbox" />
              <span>Le client a des salariés déclarés</span>
            </label>
          </Field>
        </div>
      </Card>

      <Card title="Honoraires">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Montant HT (MAD)" htmlFor="feeAmount" error={fieldError("feeAmount")}>
            <Input id="feeAmount" name="feeAmount" type="number" min={0} step="0.01" />
          </Field>
          <Field label="Périodicité" htmlFor="feeFrequency" error={fieldError("feeFrequency")}>
            <Select id="feeFrequency" name="feeFrequency" defaultValue="monthly">
              <option value="monthly">Mensuelle</option>
              <option value="quarterly">Trimestrielle</option>
              <option value="yearly">Annuelle</option>
              <option value="none">Ponctuelle</option>
            </Select>
          </Field>
        </div>
      </Card>

      <div className="flex justify-end gap-2">
        <Button type="submit" disabled={pending}>
          {pending ? "Création…" : "Créer le dossier"}
        </Button>
      </div>
    </form>
  );
}
