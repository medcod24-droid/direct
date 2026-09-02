"use client";

import { useActionState } from "react";
import { signupAction, type ActionState } from "@/app/actions/auth";
import { Alert, Button, Field, Input, Select } from "@/components/ui";

const initial: ActionState = {};

export function SignupForm() {
  const [state, action, pending] = useActionState(signupAction, initial);

  return (
    <form action={action} className="grid gap-4">
      {state.error ? <Alert tone="danger">{state.error}</Alert> : null}

      <Field label="Nom du cabinet" htmlFor="cabinetName">
        <Input id="cabinetName" name="cabinetName" required autoFocus />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Ordre professionnel" htmlFor="ordre">
          <Select id="ordre" name="ordre" required defaultValue="OPCA">
            <option value="OPCA">Comptable agréé (OPCA)</option>
            <option value="OEC">Expert-comptable (OEC)</option>
          </Select>
        </Field>
        <Field
          label="N° d'inscription"
          htmlFor="ordreNum"
          hint="Exigé : exercer sans inscription n'est plus légal depuis août 2025."
        >
          <Input id="ordreNum" name="ordreNum" required />
        </Field>
      </div>

      <Field label="Votre nom" htmlFor="name">
        <Input id="name" name="name" required autoComplete="name" />
      </Field>
      <Field label="Adresse e-mail" htmlFor="email">
        <Input id="email" name="email" type="email" required autoComplete="email" />
      </Field>
      <Field
        label="Mot de passe"
        htmlFor="password"
        hint="12 caractères minimum, avec majuscule, minuscule et chiffre."
      >
        <Input id="password" name="password" type="password" required autoComplete="new-password" />
      </Field>

      <label className="flex items-start gap-2 text-sm text-ink2">
        <input type="checkbox" name="acceptTerms" required className="mt-1" />
        <span>
          J&apos;accepte les conditions d&apos;utilisation et je confirme être habilité à tenir la
          comptabilité de tiers.
        </span>
      </label>

      <Button type="submit" disabled={pending}>
        {pending ? "Création…" : "Créer le cabinet"}
      </Button>
    </form>
  );
}
