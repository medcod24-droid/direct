"use client";

import { useState } from "react";
import { Card, Field, Input, SearchPicker, Select } from "@/components/ui";
import type { PickerOption } from "@/components/ui";
import { subtypesFor, type ClientKind } from "@/lib/domain/enums";
import { subtypeLabel } from "@/lib/domain/labels";
import { Articles } from "./Articles";
import { ClientPhoto } from "./ClientPhoto";
import { FieldScan, type ScanInfo } from "./FieldScan";
import { Partners } from "./Partners";
import { Registrations } from "./Registrations";
import { Repeatable } from "./Repeatable";

export type ClientFieldsProps = {
  /** Valeur à afficher pour un champ, avec repli si absente. */
  value: (name: string, fallback?: string) => string;
  /** État d'une case à cocher. */
  checked: (name: string) => boolean;
  /** Message d'erreur du serveur pour un champ. */
  fieldError: (name: string) => string | undefined;
  cndpMode: string;
  /**
   * Dossier concerné, quand il existe déjà. À la création il n'y a rien à quoi
   * rattacher un document : les justificatifs n'apparaissent qu'à la
   * modification, ce qui est aussi l'usage — les scans arrivent rarement en même
   * temps que la saisie.
   */
  clientId?: string | null;
  /** Justificatif déjà déposé, par champ. */
  scans?: Record<string, ScanInfo>;
  /** Autres dossiers du cabinet, pour désigner celui qui a apporté celui-ci. */
  referrers?: PickerOption[];
};

/**
 * Champs d'un dossier client, partagés par la création et la modification.
 *
 * Les deux écrans doivent proposer exactement les mêmes champs : les séparer
 * ferait diverger la saisie et la correction, et un champ ajouté à la création
 * resterait non modifiable.
 *
 * La fiche se scinde selon le type de personne. Un contribuable individuel et
 * une société ne se décrivent pas avec les mêmes pièces : l'un a une CIN, une
 * enseigne et une immatriculation CNSS personnelle, l'autre un certificat
 * négatif et des associés. Tout afficher côte à côte obligeait à deviner quelles
 * cases laisser vides ; le formulaire ne montre donc que les champs qui existent
 * pour le type choisi.
 */
export function ClientFields({
  value,
  checked,
  fieldError,
  cndpMode,
  clientId = null,
  scans = {},
  referrers = [],
}: ClientFieldsProps) {
  const [kind, setKind] = useState<ClientKind>(
    value("kind", "company") === "individual" ? "individual" : "company",
  );
  // La forme pilote l'écran, pas seulement la valeur enregistrée : « Autre »
  // ouvre un champ libre, « Particulier » ouvre les articles d'imposition.
  const [subtype, setSubtype] = useState(() =>
    preferredSubtype(
      value("kind", "company") === "individual" ? "individual" : "company",
      value("subtype"),
    ),
  );
  const individual = kind === "individual";
  const cinAllowed = cndpMode === "authorization";

  /** Justificatif d'un champ, affiché sous le champ lui-même. */
  const scan = (fieldKey: string) => (
    <FieldScan clientId={clientId} fieldKey={fieldKey} current={scans[fieldKey]} />
  );

  return (
    <>
      <Card
        title="Identité"
        description={
          individual
            ? "Contribuable individuel : les pièces sont au nom de la personne."
            : "Personne morale : les pièces sont au nom de la société."
        }
      >
        <div className="mb-4 border-b border-line pb-4">
          <ClientPhoto clientId={clientId} current={scans.photo} error={fieldError("photo")} />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Type" htmlFor="kind" error={fieldError("kind")}>
            <Select
              id="kind"
              name="kind"
              value={kind}
              onChange={(event) => {
                const next = event.target.value as ClientKind;
                setKind(next);
                // La forme enregistrée peut ne pas exister pour le nouveau type :
                // la laisser telle quelle aurait affiché un champ vide sans que
                // rien ne le signale, et le serveur aurait refusé l'ensemble.
                setSubtype(preferredSubtype(next, subtype));
              }}
            >
              <option value="company">Personne morale</option>
              <option value="individual">Personne physique</option>
            </Select>
          </Field>
          <Field label="Forme" htmlFor="subtype" error={fieldError("subtype")}>
            <Select
              id="subtype"
              name="subtype"
              value={subtype}
              onChange={(event) => setSubtype(event.target.value)}
            >
              {subtypesFor(kind).map((subtype) => (
                <option key={subtype} value={subtype}>
                  {subtypeLabel(subtype)}
                </option>
              ))}
            </Select>
          </Field>

          {subtype === "autre" ? (
            <Field
              label="Préciser la forme"
              htmlFor="subtypeOther"
              hint="Le nom exact, tel qu'il figure sur les documents."
              error={fieldError("subtypeOther")}
            >
              <Input id="subtypeOther" name="subtypeOther" defaultValue={value("subtypeOther")} />
            </Field>
          ) : null}

          <Field
            label="Raison sociale"
            htmlFor="legalName"
            error={fieldError("legalName")}
            className={individual ? "sm:col-span-2" : undefined}
          >
            <Input id="legalName" name="legalName" required autoFocus defaultValue={value("legalName")} />
            {scan("statuts")}
          </Field>

          {individual ? (
            <Field
              label="Adresse personnelle"
              htmlFor="personalAddress"
              error={fieldError("personalAddress")}
              className="sm:col-span-2"
            >
              <Input id="personalAddress" name="personalAddress" defaultValue={value("personalAddress")} />
            </Field>
          ) : null}

          {individual && cinAllowed ? (
            <Field label="CIN" htmlFor="managerCin" error={fieldError("managerCin")}>
              <Input id="managerCin" name="managerCin" defaultValue={value("managerCin")} />
              {scan("cin")}
            </Field>
          ) : null}

          <Field label="Identifiant fiscal" htmlFor="if" error={fieldError("if")}>
            <Input id="if" name="if" inputMode="numeric" defaultValue={value("if")} />
            {scan("if")}
          </Field>
          <Field label="ICE" htmlFor="ice" hint="15 chiffres" error={fieldError("ice")}>
            <Input id="ice" name="ice" inputMode="numeric" defaultValue={value("ice")} />
            {scan("ice")}
          </Field>

          {individual ? (
            <Field
              label="Délégation"
              htmlFor="taxDistrict"
              hint="Subdivision fiscale de rattachement."
              error={fieldError("taxDistrict")}
            >
              <Input id="taxDistrict" name="taxDistrict" defaultValue={value("taxDistrict")} />
            </Field>
          ) : null}
        </div>

        {!cinAllowed ? (
          <p className="text-xs text-muted mt-3">
            Mode CNDP « déclaration » : aucun numéro de CIN n&apos;est enregistré, ni pour le
            contribuable ni pour les associés. Ces champs réapparaîtront après obtention de votre
            autorisation.
          </p>
        ) : null}
      </Card>

      {individual ? (
        <Card
          title="Enseigne commerciale"
          description="الاسم التجاري — nom sous lequel l'activité est exercée."
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Enseigne" htmlFor="tradeName" error={fieldError("tradeName")}>
              <Input id="tradeName" name="tradeName" defaultValue={value("tradeName")} />
            </Field>
            <Field label="Numéro" htmlFor="signNo" error={fieldError("signNo")}>
              <Input id="signNo" name="signNo" defaultValue={value("signNo")} />
              {scan("sign")}
            </Field>
            <Field label="Date de référence" htmlFor="signRefDate" error={fieldError("signRefDate")}>
              <Input id="signRefDate" name="signRefDate" type="date" defaultValue={value("signRefDate")} />
            </Field>
            <Field label="Expiration" htmlFor="signExpiresAt" error={fieldError("signExpiresAt")}>
              <Input
                id="signExpiresAt"
                name="signExpiresAt"
                type="date"
                defaultValue={value("signExpiresAt")}
              />
            </Field>
          </div>
        </Card>
      ) : (
        <Card
          title="Certificat négatif"
          description="Réservation de la dénomination auprès de l'OMPIC. Elle ouvre 90 jours pour immatriculer la société au registre de commerce (code de commerce, art. 74)."
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Numéro" htmlFor="negCertNo" error={fieldError("negCertNo")}>
              <Input id="negCertNo" name="negCertNo" defaultValue={value("negCertNo")} />
              {scan("negCert")}
            </Field>
            <Field label="Nom commercial" htmlFor="tradeName" error={fieldError("tradeName")}>
              <Input id="tradeName" name="tradeName" defaultValue={value("tradeName")} />
            </Field>
            <Field label="Date" htmlFor="negCertDate" error={fieldError("negCertDate")}>
              <Input id="negCertDate" name="negCertDate" type="date" defaultValue={value("negCertDate")} />
            </Field>
            <Field label="Expiration" htmlFor="negCertExpiresAt" error={fieldError("negCertExpiresAt")}>
              <Input
                id="negCertExpiresAt"
                name="negCertExpiresAt"
                type="date"
                defaultValue={value("negCertExpiresAt")}
              />
            </Field>
          </div>
        </Card>
      )}

      <Card
        title="Registre de commerce"
        description="Une immatriculation principale, plus une immatriculation secondaire par ressort où le client exploite. Chaque registre et chaque succursale porte son adresse, son numéro de patente et, si l'activité en exige une, son autorisation."
      >
        <Registrations value={value} fieldError={fieldError} clientId={clientId} scans={scans} />
      </Card>

      <Card title="Activité">
        <Repeatable
          name="activities"
          value={value}
          fieldError={fieldError}
          addLabel={individual ? "Ajouter une activité" : "Ajouter un objet social"}
          emptyLabel={
            individual ? "Aucune activité déclarée." : "Aucun objet social déclaré."
          }
          columns={[
            {
              key: "value",
              label: individual ? "Activité" : "Objet social",
              className: "min-w-64 flex-1",
            },
          ]}
        />
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <Field label="Date de début d'activité" htmlFor="startedAt" error={fieldError("startedAt")}>
            <Input id="startedAt" name="startedAt" type="date" defaultValue={value("startedAt")} />
          </Field>
        </div>
      </Card>

      {individual && subtype === "particulier" ? (
        <Card
          title="Articles d'imposition"
          description="Un article par bien imposé. L'usage décide du traitement : seule l'habitation principale bénéficie de l'abattement de taxe d'habitation, un bien loué relève des revenus fonciers."
        >
          <Articles value={value} fieldError={fieldError} clientId={clientId} scans={scans} />
        </Card>
      ) : null}

      <Card title="Adresses">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field
            label={individual ? "Adresse professionnelle" : "Siège social ou domiciliation"}
            htmlFor="address"
            hint={
              individual
                ? "Lieu d'exercice — tient lieu de siège."
                : "Justificatif attendu : contrat de bail, titre de propriété, ou contrat de domiciliation (loi 89-17)."
            }
            error={fieldError("address")}
            className="sm:col-span-2"
          >
            <Input id="address" name="address" defaultValue={value("address")} />
            {scan("siege")}
          </Field>

          {individual ? null : (
            <Field label="Domiciliation" htmlFor="isDomiciled" error={fieldError("isDomiciled")}>
              <label className="flex items-center gap-2 text-sm h-9">
                <input
                  id="isDomiciled"
                  name="isDomiciled"
                  type="checkbox"
                  defaultChecked={checked("isDomiciled")}
                />
                <span>Siège chez un domiciliataire</span>
              </label>
            </Field>
          )}

          <Field label="Ville" htmlFor="city" error={fieldError("city")}>
            <Input id="city" name="city" defaultValue={value("city")} />
          </Field>
        </div>
      </Card>

      {individual ? null : (
        <Card
          title="Direction et associés"
          description="Chaque gérant ou associé porte son propre justificatif : copie de CIN, procès-verbal de nomination."
        >
          <Partners
            value={value}
            fieldError={fieldError}
            clientId={clientId}
            scans={scans}
            cinAllowed={cinAllowed}
          />
        </Card>
      )}

      <Card title="CNSS">
        <div className="grid gap-3 sm:grid-cols-2">
          {individual ? (
            <Field
              label="Immatriculation"
              htmlFor="cnssRegNo"
              hint="9 chiffres — immatriculation de la personne."
              error={fieldError("cnssRegNo")}
            >
              <Input id="cnssRegNo" name="cnssRegNo" inputMode="numeric" defaultValue={value("cnssRegNo")} />
              {scan("cnssReg")}
            </Field>
          ) : null}
          <Field
            label="N° d'affiliation"
            htmlFor="cnssNo"
            hint="Affiliation en tant qu'employeur."
            error={fieldError("cnssNo")}
          >
            <Input id="cnssNo" name="cnssNo" defaultValue={value("cnssNo")} />
            {scan("cnssAffiliation")}
          </Field>
          <Field
            label="Date d'affiliation"
            htmlFor="cnssAffiliatedAt"
            error={fieldError("cnssAffiliatedAt")}
          >
            <Input
              id="cnssAffiliatedAt"
              name="cnssAffiliatedAt"
              type="date"
              defaultValue={value("cnssAffiliatedAt")}
            />
          </Field>
          <Field
            label="Nombre de salariés"
            htmlFor="employeeCount"
            hint="Ignoré dès que les salariés sont nommés ci-dessous."
            error={fieldError("employeeCount")}
          >
            <Input
              id="employeeCount"
              name="employeeCount"
              type="number"
              min={0}
              defaultValue={value("employeeCount")}
            />
          </Field>
        </div>

        <div className="mt-4 border-t border-line pt-3">
          <p className="text-[13px] font-medium text-ink2 mb-1.5">Salariés déclarés</p>
          <Repeatable
            name="employees"
            max={200}
            value={value}
            fieldError={fieldError}
            addLabel="Ajouter un salarié"
            emptyLabel="Aucun salarié nommé."
            columns={[
              { key: "name", label: "Nom et prénom" },
              ...(cinAllowed ? [{ key: "cin", label: "CIN", className: "min-w-32" }] : []),
              { key: "cnssNo", label: "N° CNSS", className: "min-w-36" },
            ]}
          />
          <p className="text-xs text-muted mt-2">
            Données personnelles de tiers : elles n&apos;ont leur place ici que pour les
            déclarations du cabinet.
          </p>
        </div>
      </Card>

      <Card title="Coordonnées">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Téléphone" htmlFor="phone" error={fieldError("phone")}>
            <Input id="phone" name="phone" type="tel" defaultValue={value("phone")} />
          </Field>
          <Field label="E-mail" htmlFor="email" error={fieldError("email")}>
            <Input id="email" name="email" type="email" defaultValue={value("email")} />
          </Field>
          <Field label="Site web" htmlFor="website" error={fieldError("website")}>
            <Input id="website" name="website" defaultValue={value("website")} />
          </Field>
        </div>
      </Card>

      <Card title="Régime et échéances">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Régime fiscal" htmlFor="taxRegime" error={fieldError("taxRegime")}>
            <Select key={value("taxRegime", "is")} id="taxRegime" name="taxRegime" defaultValue={value("taxRegime", "is")}>
              <option value="is">IS</option>
              <option value="rnr">IR — RNR</option>
              <option value="rns">IR — RNS</option>
              <option value="cpu">CPU</option>
              <option value="auto_entrepreneur">Auto-entrepreneur</option>
              <option value="none">Aucun</option>
            </Select>
          </Field>
          <Field label="Régime de TVA" htmlFor="vatRegime" hint="Mensuel dès 1 000 000 MAD de CA taxable" error={fieldError("vatRegime")}>
            <Select key={value("vatRegime", "quarterly")} id="vatRegime" name="vatRegime" defaultValue={value("vatRegime", "quarterly")}>
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

      <Card
        title="Origine du dossier"
        description="Sert à savoir à qui l'on doit ce client."
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <Field
            label="Apporté par"
            htmlFor="referredById"
            hint={
              referrers.length === 0
                ? "Aucun autre dossier au cabinet pour l'instant."
                : "Cherchez par nom, ICE, RC, CIN ou téléphone."
            }
            error={fieldError("referredById")}
          >
            <SearchPicker
              id="referredById"
              name="referredById"
              options={referrers}
              defaultValue={value("referredById")}
              disabled={referrers.length === 0}
              emptyLabel="Aucun apporteur"
              placeholder="Nom, ICE, RC, CIN, téléphone…"
            />
          </Field>
        </div>
      </Card>

      <Card title="Honoraires">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Montant HT (MAD)" htmlFor="feeAmount" error={fieldError("feeAmount")}>
            <Input id="feeAmount" name="feeAmount" type="number" min={0} step="0.01"  defaultValue={value("feeAmount")} />
          </Field>
          <Field label="Périodicité" htmlFor="feeFrequency" error={fieldError("feeFrequency")}>
            <Select key={value("feeFrequency", "monthly")} id="feeFrequency" name="feeFrequency" defaultValue={value("feeFrequency", "monthly")}>
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

/** Forme à présélectionner : celle enregistrée si elle vaut pour ce type, sinon la première. */
function preferredSubtype(kind: ClientKind, current: string): string {
  const allowed = subtypesFor(kind);
  return allowed.includes(current as (typeof allowed)[number]) ? current : (allowed[0] ?? "");
}
