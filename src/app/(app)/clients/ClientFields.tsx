"use client";

import { Card, Field, Input, Select, Textarea } from "@/components/ui";

export const CLIENT_SUBTYPES = [
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

export type ClientFieldsProps = {
  /** Valeur à afficher pour un champ, avec repli si absente. */
  value: (name: string, fallback?: string) => string;
  /** État d'une case à cocher. */
  checked: (name: string) => boolean;
  /** Message d'erreur du serveur pour un champ. */
  fieldError: (name: string) => string | undefined;
  cndpMode: string;
};

/**
 * Champs d'un dossier client, partagés par la création et la modification.
 *
 * Les deux écrans doivent proposer exactement les mêmes champs : les séparer
 * ferait diverger la saisie et la correction, et un champ ajouté à la création
 * resterait non modifiable.
 */
export function ClientFields({ value, checked, fieldError, cndpMode }: ClientFieldsProps) {
  return (
    <>
      <Card title="Identité">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Raison sociale ou nom" htmlFor="legalName" error={fieldError("legalName")}>
            <Input id="legalName" name="legalName" required autoFocus  defaultValue={value("legalName")} />
          </Field>
          <Field label="Nom commercial" htmlFor="tradeName" error={fieldError("tradeName")}>
            <Input id="tradeName" name="tradeName"  defaultValue={value("tradeName")} />
          </Field>
          <Field label="Type" htmlFor="kind" error={fieldError("kind")}>
            <Select id="kind" name="kind" defaultValue={value("kind", "company")}>
              <option value="company">Personne morale</option>
              <option value="individual">Personne physique</option>
            </Select>
          </Field>
          <Field label="Forme" htmlFor="subtype" error={fieldError("subtype")}>
            <Select id="subtype" name="subtype" defaultValue={value("subtype", "sarl")}>
              {CLIENT_SUBTYPES.map((group) => (
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
            <Input id="ice" name="ice" inputMode="numeric"  defaultValue={value("ice")} />
          </Field>
          <Field label="Identifiant fiscal" htmlFor="if" error={fieldError("if")}>
            <Input id="if" name="if" inputMode="numeric"  defaultValue={value("if")} />
          </Field>
          <Field label="Registre de commerce" htmlFor="rc" error={fieldError("rc")}>
            <Input id="rc" name="rc"  defaultValue={value("rc")} />
          </Field>
          <Field label="Ville" htmlFor="city" error={fieldError("city")}>
            <Input id="city" name="city"  defaultValue={value("city")} />
          </Field>
          <Field label="Téléphone" htmlFor="phone" error={fieldError("phone")}>
            <Input id="phone" name="phone" type="tel"  defaultValue={value("phone")} />
          </Field>
          <Field label="E-mail" htmlFor="email" error={fieldError("email")}>
            <Input id="email" name="email" type="email"  defaultValue={value("email")} />
          </Field>
          <Field label="Activité" htmlFor="activity" error={fieldError("activity")}>
            <Input id="activity" name="activity"  defaultValue={value("activity")} />
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
            <Select id="taxRegime" name="taxRegime" defaultValue={value("taxRegime", "is")}>
              <option value="is">IS</option>
              <option value="rnr">IR — RNR</option>
              <option value="rns">IR — RNS</option>
              <option value="cpu">CPU</option>
              <option value="auto_entrepreneur">Auto-entrepreneur</option>
              <option value="none">Aucun</option>
            </Select>
          </Field>
          <Field label="Régime de TVA" htmlFor="vatRegime" hint="Mensuel dès 1 000 000 MAD de CA taxable" error={fieldError("vatRegime")}>
            <Select id="vatRegime" name="vatRegime" defaultValue={value("vatRegime", "quarterly")}>
              <option value="quarterly">Trimestriel</option>
              <option value="monthly">Mensuel</option>
              <option value="exempt">Hors champ / exonéré</option>
            </Select>
          </Field>
          <Field label="Clôture — mois" htmlFor="fiscalYearEndMonth" error={fieldError("fiscalYearEndMonth")}>
            <Input id="fiscalYearEndMonth" name="fiscalYearEndMonth" type="number" min={1} max={12} defaultValue={value("fiscalYearEndMonth", "12")} />
          </Field>
          <Field label="Clôture — jour" htmlFor="fiscalYearEndDay" error={fieldError("fiscalYearEndDay")}>
            <Input id="fiscalYearEndDay" name="fiscalYearEndDay" type="number" min={1} max={31} defaultValue={value("fiscalYearEndDay", "31")} />
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
              defaultValue={value("takeoverDate", new Date().toISOString().slice(0, 10))}
            />
          </Field>
          <Field label="Employeur (CNSS)" htmlFor="isEmployer" error={fieldError("isEmployer")}>
            <label className="flex items-center gap-2 text-sm h-9">
              <input
                id="isEmployer"
                name="isEmployer"
                type="checkbox"
                defaultChecked={checked("isEmployer")}
              />
              <span>Le client a des salariés déclarés</span>
            </label>
          </Field>
        </div>
      </Card>

      <Card title="Honoraires">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Montant HT (MAD)" htmlFor="feeAmount" error={fieldError("feeAmount")}>
            <Input id="feeAmount" name="feeAmount" type="number" min={0} step="0.01"  defaultValue={value("feeAmount")} />
          </Field>
          <Field label="Périodicité" htmlFor="feeFrequency" error={fieldError("feeFrequency")}>
            <Select id="feeFrequency" name="feeFrequency" defaultValue={value("feeFrequency", "monthly")}>
              <option value="monthly">Mensuelle</option>
              <option value="quarterly">Trimestrielle</option>
              <option value="yearly">Annuelle</option>
              <option value="none">Ponctuelle</option>
            </Select>
          </Field>
        </div>
      </Card>

    </>
  );
}
