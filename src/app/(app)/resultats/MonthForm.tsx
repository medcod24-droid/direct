"use client";

import { useActionState, useState } from "react";
import { saveMonthlyResultAction, type ActionState } from "@/app/actions/app";
import { Alert, Button, Field, Input, Modal, Select, Textarea } from "@/components/ui";
import { formatMad } from "@/lib/format";

export type MonthDraft = {
  month: number;
  label: string;
  revenue: number;
  expenses: number;
  invoiced: number;
  notes: string | null;
  filled: boolean;
};

const initial: ActionState = {};

/** Centimes → champ en dirhams, sans notation scientifique ni arrondi surprise. */
const toInput = (centimes: number) => (centimes === 0 ? "" : (centimes / 100).toFixed(2));

/**
 * Saisie du résultat d'un mois.
 *
 * Le montant facturé du mois est rappelé sous le champ « revenus » : c'est le
 * repère dont dispose le cabinet, sans pour autant décider à sa place — facturé
 * n'est pas encaissé.
 */
export function MonthForm({
  year,
  months,
  current,
  trigger,
  open: controlledOpen,
  onClose,
}: {
  year: number;
  months: MonthDraft[];
  current?: MonthDraft;
  trigger?: string;
  open?: boolean;
  onClose?: () => void;
}) {
  const [ownOpen, setOwnOpen] = useState(false);
  const open = controlledOpen ?? ownOpen;
  const close = () => {
    setOwnOpen(false);
    onClose?.();
  };

  const [state, formAction, pending] = useActionState(saveMonthlyResultAction, initial);
  const value = (name: string, fallback = "") => state.values?.[name] ?? fallback;

  // À l'ouverture sans mois choisi, on propose le dernier mois non saisi.
  const suggested = current ?? months.find((month) => !month.filled) ?? months[0];
  const [selected, setSelected] = useState(suggested?.month ?? 0);
  const shown = current ?? months.find((month) => month.month === selected) ?? suggested;

  const monthValue = `${year}-${String((current?.month ?? selected) + 1).padStart(2, "0")}`;

  return (
    <>
      {trigger ? (
        <Button variant="primary" size="sm" onClick={() => setOwnOpen(true)}>
          {trigger}
        </Button>
      ) : null}

      <Modal
        open={open}
        onClose={close}
        title={current ? `${current.label} ${year}` : "Saisir un mois"}
        size="lg"
      >
        <form action={formAction} className="grid gap-3">
          {state.error ? <Alert tone="danger">{state.error}</Alert> : null}
          {state.ok ? <Alert tone="success">{state.message}</Alert> : null}

          {current ? (
            <input type="hidden" name="month" value={monthValue} />
          ) : (
            <Field label="Mois" htmlFor="month">
              <Select
                id="month"
                name="month"
                value={monthValue}
                onChange={(event) => setSelected(Number(event.target.value.slice(5)) - 1)}
              >
                {months.map((month) => (
                  <option
                    key={month.month}
                    value={`${year}-${String(month.month + 1).padStart(2, "0")}`}
                  >
                    {month.label} {year}
                    {month.filled ? " — déjà saisi" : ""}
                  </option>
                ))}
              </Select>
            </Field>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            <Field
              label="Revenus (MAD)"
              htmlFor="revenue"
              hint={
                shown && shown.invoiced > 0
                  ? `Honoraires facturés ce mois-là : ${formatMad(shown.invoiced)}`
                  : "Ce qui est réellement entré ce mois-là."
              }
              error={state.fieldErrors?.revenue?.[0]}
            >
              <Input
                id="revenue"
                name="revenue"
                type="number"
                min={0}
                step="0.01"
                autoFocus
                defaultValue={value("revenue", toInput(shown?.revenue ?? 0))}
              />
            </Field>

            <Field
              label="Charges (MAD)"
              htmlFor="expenses"
              hint="Loyer, salaires, fournitures, déplacements…"
              error={state.fieldErrors?.expenses?.[0]}
            >
              <Input
                id="expenses"
                name="expenses"
                type="number"
                min={0}
                step="0.01"
                defaultValue={value("expenses", toInput(shown?.expenses ?? 0))}
              />
            </Field>
          </div>

          <Field
            label="Remarque"
            htmlFor="notes"
            hint="Ce qui explique un mois hors norme : un gros règlement, une charge exceptionnelle."
          >
            <Textarea
              id="notes"
              name="notes"
              rows={3}
              defaultValue={value("notes", shown?.notes ?? "")}
            />
          </Field>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={close}>
              {state.ok ? "Fermer" : "Annuler"}
            </Button>
            <Button type="submit" variant="primary" disabled={pending}>
              {pending ? "Enregistrement…" : "Enregistrer"}
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}

/** Ouvre la saisie d'un mois donné depuis la ligne du tableau. */
export function EditMonth({
  year,
  months,
  month,
}: {
  year: number;
  months: MonthDraft[];
  month: MonthDraft;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="ghost" size="sm" onClick={() => setOpen(true)}>
        {month.filled ? "Modifier" : "Saisir"}
      </Button>
      {open ? (
        <MonthForm
          year={year}
          months={months}
          current={month}
          open
          onClose={() => setOpen(false)}
        />
      ) : null}
    </>
  );
}
