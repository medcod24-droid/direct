"use client";

import { useActionState } from "react";
import { updateCabinetSettingsAction, type ActionState } from "@/app/actions/app";
import { Alert, Button, Field, Input, Select } from "@/components/ui";

const initial: ActionState = {};

/**
 * Réglages du cabinet.
 *
 * `cndpMode` n'est pas cosmétique : en « autorisation », le numéro de CIN des
 * gérants devient enregistrable. L'aide le dit là où le choix se fait, plutôt
 * que dans une documentation séparée.
 */
export function CabinetSettingsForm({ current }: { current: Record<string, string> }) {
  const [state, action, pending] = useActionState(updateCabinetSettingsAction, initial);
  const value = (name: string, fallback = "") =>
    state.values?.[name] ?? current[name] ?? fallback;
  const fieldError = (name: string) => state.fieldErrors?.[name]?.[0];

  return (
    <form action={action} className="grid gap-3">
      {state.error ? <Alert tone="danger">{state.error}</Alert> : null}
      {state.ok ? <Alert tone="success">{state.message}</Alert> : null}

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Nom du cabinet" htmlFor="name" error={fieldError("name")}>
          <Input id="name" name="name" required defaultValue={value("name")} />
        </Field>
        <Field label="Ville" htmlFor="city" error={fieldError("city")}>
          <Input id="city" name="city" defaultValue={value("city")} />
        </Field>
        <Field label="ICE" htmlFor="ice" hint="15 chiffres" error={fieldError("ice")}>
          <Input id="ice" name="ice" inputMode="numeric" defaultValue={value("ice")} />
        </Field>
        <Field label="Identifiant fiscal" htmlFor="if" error={fieldError("if")}>
          <Input id="if" name="if" inputMode="numeric" defaultValue={value("if")} />
        </Field>
        <Field label="Registre de commerce" htmlFor="rc" error={fieldError("rc")}>
          <Input id="rc" name="rc" defaultValue={value("rc")} />
        </Field>
        <Field label="Téléphone" htmlFor="phone" error={fieldError("phone")}>
          <Input id="phone" name="phone" type="tel" defaultValue={value("phone")} />
        </Field>
        <Field label="E-mail" htmlFor="email" error={fieldError("email")}>
          <Input id="email" name="email" type="email" defaultValue={value("email")} />
        </Field>
        <Field label="Ordre professionnel" htmlFor="ordre" error={fieldError("ordre")}>
          <Select key={value("ordre")} id="ordre" name="ordre" defaultValue={value("ordre")}>
            <option value="">Non renseigné</option>
            <option value="OPCA">OPCA — comptable agréé</option>
            <option value="OEC">OEC — expert-comptable</option>
          </Select>
        </Field>
        <Field label="Numéro d'inscription" htmlFor="ordreNum" error={fieldError("ordreNum")}>
          <Input id="ordreNum" name="ordreNum" defaultValue={value("ordreNum")} />
        </Field>
      </div>

      <div className="mt-2 grid gap-3 rounded-lg border border-line p-4 sm:grid-cols-2">
        <Field
          label="Mode CNDP"
          htmlFor="cndpMode"
          hint="En « autorisation », le numéro de CIN des gérants peut être enregistré."
          error={fieldError("cndpMode")}
        >
          <Select key={value("cndpMode", "declaration")} id="cndpMode" name="cndpMode" defaultValue={value("cndpMode", "declaration")}>
            <option value="declaration">Déclaration — aucun CIN enregistré</option>
            <option value="authorization">Autorisation — CIN enregistrable</option>
          </Select>
        </Field>
        <Field
          label="Référence du dossier CNDP"
          htmlFor="cndpRef"
          hint="Exigée pour passer en mode « autorisation »."
          error={fieldError("cndpRef")}
        >
          <Input id="cndpRef" name="cndpRef" defaultValue={value("cndpRef")} />
        </Field>
      </div>

      <div className="flex justify-end">
        <Button type="submit" variant="primary" disabled={pending}>
          {pending ? "Enregistrement…" : "Enregistrer les réglages"}
        </Button>
      </div>
    </form>
  );
}
