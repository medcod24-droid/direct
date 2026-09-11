"use client";

import { clsx } from "clsx";
import { useId, useState } from "react";
import {
  Badge,
  Button,
  Field,
  Icon,
  IconChip,
  Input,
  ProgressBar,
  type IconName,
} from "@/components/ui";
import {
  ALWAYS_GRANTED,
  GRANTABLE,
  PERMISSION_GROUPS,
  REQUIRES,
  dependentsOf,
  normalizePermissions,
  permissionLabel,
  presetPermissions,
  requirementsOf,
  type AdjustableRole,
  type Permission,
} from "@/lib/authz/permissions";

const GROUP_ICONS: Record<string, IconName> = {
  cabinet: "building",
  team: "team",
  clients: "clients",
  documents: "doc",
  requests: "inbox",
  deadlines: "calendar",
  tasks: "task",
  todos: "check",
  appointments: "clock",
  interventions: "folder",
  invoices: "coins",
  finance: "chart",
};

const ROLE_CHOICES: {
  role: AdjustableRole;
  title: string;
  description: string;
  icon: IconName;
}[] = [
  {
    role: "accountant",
    title: "Comptable",
    description: "Tient les dossiers, les pièces et les échéances.",
    icon: "folder",
  },
  {
    role: "assistant",
    title: "Assistant",
    description: "Accueil, agenda, dépôt des pièces.",
    icon: "calendar",
  },
  {
    role: "admin",
    title: "Administrateur",
    description: "Tout, y compris l'équipe et le résultat du cabinet.",
    icon: "shield",
  },
  {
    role: "custom",
    title: "Autre",
    description: "Un rôle que vous nommez et composez case par case.",
    icon: "edit",
  },
];

const TEMPLATES: AdjustableRole[] = ["accountant", "assistant", "admin"];

export type RightsEditorProps = {
  defaultRole?: AdjustableRole;
  defaultLabel?: string;
  /** Cases cochées au départ ; à défaut, le modèle du rôle. */
  defaultPermissions?: Permission[];
  defaultRestricted?: boolean;
  /** Ce que la personne connectée peut accorder : le reste est grisé. */
  grantable: Permission[];
  fieldError?: (name: string) => string | undefined;
};

/**
 * Rôle et grille de droits d'un collaborateur.
 *
 * Le rôle choisi pré-remplit la grille ; chaque case reste ajustable, et
 * « Autre » part de la sélection en cours, qu'on complète ou qu'on remplace par
 * un modèle. Les dépendances sont appliquées ici pour que l'administration voie
 * tout de suite ce qu'un clic entraîne — le service les applique de toute façon.
 *
 * Tout est contrôlé : après un envoi refusé, React réinitialise les champs non
 * contrôlés du formulaire, et la grille ne doit pas revenir au modèle sous les
 * yeux de celui qui vient de la composer.
 */
export function RightsEditor({
  defaultRole = "accountant",
  defaultLabel = "",
  defaultPermissions,
  defaultRestricted = false,
  grantable,
  fieldError,
}: RightsEditorProps) {
  const uid = useId();
  const mine = new Set(grantable);
  const clamp = (list: Permission[]) => normalizePermissions(list.filter((p) => mine.has(p)));

  const [role, setRole] = useState<AdjustableRole>(defaultRole);
  const [label, setLabel] = useState(defaultLabel);
  const [restricted, setRestricted] = useState(defaultRestricted);
  const [selected, setSelected] = useState<Set<Permission>>(
    () => new Set(defaultPermissions ?? clamp(presetPermissions(defaultRole))),
  );

  const template = role === "custom" ? null : clamp(presetPermissions(role));
  const adjusted =
    template !== null &&
    (template.length !== selected.size || template.some((p) => !selected.has(p)));
  const sensitiveCount = PERMISSION_GROUPS.flatMap((group) => group.items).filter(
    (item) => item.sensitive && selected.has(item.permission),
  ).length;

  function chooseRole(next: AdjustableRole) {
    setRole(next);
    // « Autre » garde la sélection en cours comme point de départ.
    if (next !== "custom") setSelected(new Set(clamp(presetPermissions(next))));
  }

  function change(permissions: Permission[], on: boolean) {
    setSelected((current) => {
      const next = new Set(current);
      for (const permission of permissions) {
        if (on) {
          next.add(permission);
          for (const required of requirementsOf(permission)) next.add(required);
        } else {
          next.delete(permission);
          for (const dependent of dependentsOf(permission)) next.delete(dependent);
        }
      }
      for (const permission of ALWAYS_GRANTED) next.add(permission);
      return next;
    });
  }

  const roleError = fieldError?.("role");
  const permissionsError = fieldError?.("permissions");

  return (
    <div className="grid gap-4">
      <input type="hidden" name="rights" value="1" />

      <fieldset className="grid gap-2">
        <legend className="mb-2 text-2xs font-650 uppercase tracking-[0.08em] text-muted">
          Rôle
        </legend>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {ROLE_CHOICES.map((choice) => {
            const active = role === choice.role;
            return (
              <label
                key={choice.role}
                className={clsx(
                  "flex cursor-pointer gap-3 rounded-card border p-3 transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-accent",
                  active ? "border-accent bg-accentSoft" : "border-line bg-surface hover:bg-surface2",
                )}
              >
                <input
                  type="radio"
                  name="role"
                  value={choice.role}
                  checked={active}
                  onChange={() => chooseRole(choice.role)}
                  className="sr-only"
                />
                <IconChip name={choice.icon} size={28} tone={active ? "accent" : "neutral"} />
                <span className="min-w-0">
                  <span className="flex items-center gap-1.5 text-sm font-650 text-ink">
                    {choice.title}
                    {active ? <Icon name="check" size={14} className="text-accent" /> : null}
                  </span>
                  <span className="mt-0.5 block text-xs text-muted">{choice.description}</span>
                </span>
              </label>
            );
          })}
        </div>
        {roleError ? <p className="text-xs text-danger">{roleError}</p> : null}
      </fieldset>

      <div className="grid gap-3 sm:grid-cols-2">
        {role === "custom" ? (
          <Field
            label="Nom du rôle"
            htmlFor={`${uid}-label`}
            hint="Tel qu'il apparaîtra dans l'équipe et en haut de son écran."
            error={fieldError?.("roleLabel")}
          >
            <Input
              id={`${uid}-label`}
              name="roleLabel"
              value={label}
              maxLength={60}
              placeholder="Stagiaire, secrétaire, coursier…"
              onChange={(event) => setLabel(event.target.value)}
            />
          </Field>
        ) : null}
        <Field
          label="Portée"
          htmlFor={`${uid}-scope`}
          hint="Restreint tous les droits ci-dessous aux dossiers qui lui sont assignés."
        >
          <label className="flex h-[38px] items-center gap-2 text-sm">
            <input
              id={`${uid}-scope`}
              name="restrictedToAssigned"
              type="checkbox"
              checked={restricted}
              onChange={(event) => setRestricted(event.target.checked)}
              className="h-4 w-4 accent-accent"
            />
            <span>Dossiers assignés seulement</span>
          </label>
        </Field>
      </div>

      <div className="rounded-card border border-line bg-surface2 p-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <p className="text-sm font-650 text-ink">
              <span className="tabular">{selected.size}</span> droits accordés sur{" "}
              <span className="tabular">{GRANTABLE.length}</span>
            </p>
            <p className="mt-0.5 text-xs text-muted">
              {role === "custom"
                ? "Composez ce rôle case par case, ou partez d'un modèle."
                : adjusted
                  ? "Modèle ajusté : les cases diffèrent du rôle standard."
                  : "Droits standard du rôle. Chaque case reste ajustable."}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            {role === "custom" ? (
              <>
                <span className="text-xs text-muted">Partir de :</span>
                {TEMPLATES.map((from) => (
                  <Button
                    key={from}
                    size="sm"
                    variant="ghost"
                    onClick={() => setSelected(new Set(clamp(presetPermissions(from))))}
                  >
                    {ROLE_CHOICES.find((choice) => choice.role === from)?.title}
                  </Button>
                ))}
                <Button size="sm" variant="ghost" onClick={() => setSelected(new Set(ALWAYS_GRANTED))}>
                  Tout décocher
                </Button>
              </>
            ) : adjusted && template ? (
              <Button size="sm" variant="ghost" onClick={() => setSelected(new Set(template))}>
                Rétablir les droits du rôle
              </Button>
            ) : null}
          </div>
        </div>
        <ProgressBar
          value={selected.size}
          total={GRANTABLE.length}
          height={4}
          className="mt-2.5"
          label="Droits accordés"
        />
        {sensitiveCount > 0 ? (
          <p className="mt-2 flex items-center gap-1.5 text-xs text-warn">
            <Icon name="alert" size={13} />
            {sensitiveCount} droit{sensitiveCount > 1 ? "s" : ""} sensible
            {sensitiveCount > 1 ? "s" : ""} accordé{sensitiveCount > 1 ? "s" : ""} : accès, argent
            ou suppression.
          </p>
        ) : null}
        {permissionsError ? <p className="mt-2 text-xs text-danger">{permissionsError}</p> : null}
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {PERMISSION_GROUPS.map((group) => {
          const granted = group.items.filter((item) => selected.has(item.permission)).length;
          const togglable = group.items
            .map((item) => item.permission)
            .filter((permission) => mine.has(permission) && !ALWAYS_GRANTED.includes(permission));
          const allOn = togglable.every((permission) => selected.has(permission));

          return (
            <section
              key={group.key}
              className="rounded-card border border-line bg-surface p-3 shadow-edge"
            >
              <header className="mb-1.5 flex items-center gap-2.5">
                <IconChip
                  name={GROUP_ICONS[group.key] ?? "shield"}
                  size={28}
                  tone={granted > 0 ? "accent" : "neutral"}
                />
                <h3 className="min-w-0 flex-1 text-sm font-650 text-ink">{group.title}</h3>
                <span className="tabular text-xs text-muted">
                  {granted}/{group.items.length}
                </span>
                {togglable.length > 1 ? (
                  <button
                    type="button"
                    onClick={() => change(togglable, !allOn)}
                    className="rounded-chip px-1.5 py-0.5 text-xs font-550 text-accent transition-colors hover:bg-accentSoft"
                  >
                    {allOn ? "Tout retirer" : "Tout cocher"}
                  </button>
                ) : null}
              </header>

              <ul className="grid gap-0.5">
                {group.items.map((item) => {
                  const locked = ALWAYS_GRANTED.includes(item.permission);
                  const allowed = mine.has(item.permission);
                  const needs = REQUIRES[item.permission] ?? [];
                  const id = `${uid}-${item.permission}`;
                  return (
                    <li key={item.permission}>
                      <label
                        htmlFor={id}
                        className={clsx(
                          "flex gap-2.5 rounded-chip px-2 py-1.5 transition-colors",
                          allowed && !locked ? "cursor-pointer hover:bg-surface2" : "opacity-75",
                        )}
                      >
                        <input
                          id={id}
                          type="checkbox"
                          name="permissions"
                          value={item.permission}
                          checked={selected.has(item.permission)}
                          disabled={locked || !allowed}
                          onChange={(event) => change([item.permission], event.target.checked)}
                          className="mt-0.5 h-4 w-4 shrink-0 accent-accent"
                        />
                        <span className="min-w-0 flex-1">
                          <span className="flex flex-wrap items-center gap-1.5 text-[13px] text-ink">
                            {item.label}
                            {item.sensitive ? (
                              <Badge tone="amber" iconName="alert" dot={false}>
                                sensible
                              </Badge>
                            ) : null}
                          </span>
                          {item.description ? (
                            <span className="mt-0.5 block text-xs text-muted">{item.description}</span>
                          ) : null}
                          {needs.length > 0 ? (
                            <span className="mt-0.5 block text-2xs text-muted">
                              Suppose : {needs.map(permissionLabel).join(" · ")}
                            </span>
                          ) : null}
                          {!allowed ? (
                            <span className="mt-0.5 block text-2xs text-muted">
                              Vous ne détenez pas ce droit : vous ne pouvez pas l&apos;accorder.
                            </span>
                          ) : null}
                        </span>
                      </label>
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })}
      </div>
    </div>
  );
}
