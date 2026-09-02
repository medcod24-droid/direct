import { clsx } from "clsx";
import type { ReactNode } from "react";
import { getDictionary, t, type Locale } from "@/lib/i18n";

/** Attributs à appliquer au contrôle pour que le câblage ARIA soit complet. */
export type FieldControlProps = {
  id: string;
  "aria-describedby"?: string;
  "aria-invalid"?: true;
  required?: boolean;
};

export type FieldProps = {
  /** Identifiant du contrôle : sert de `htmlFor` et de base aux ids ARIA. */
  id?: string;
  /** Alias de `id`, pour lire comme un `<label htmlFor>`. */
  htmlFor?: string;
  label: string;
  hint?: string;
  error?: string;
  required?: boolean;
  /** Affiche « (facultatif) » à côté du libellé. */
  optional?: boolean;
  className?: string;
  locale?: Locale;
  /**
   * Soit un contrôle déjà câblé, soit une fonction recevant les attributs
   * à étaler sur le contrôle — c'est la forme à préférer.
   */
  children: ReactNode | ((control: FieldControlProps) => ReactNode);
};

export function Field({
  id,
  htmlFor,
  label,
  hint,
  error,
  required = false,
  optional = false,
  className,
  locale = "fr",
  children,
}: FieldProps) {
  const dict = getDictionary(locale);
  // Le rendu est serveur : pas de `useId`, l'identifiant est déterministe.
  const controlId = id ?? htmlFor ?? slugify(label);
  const hintId = hint ? `${controlId}-hint` : undefined;
  const errorId = error ? `${controlId}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(" ") || undefined;

  const control: FieldControlProps = {
    id: controlId,
    ...(describedBy ? { "aria-describedby": describedBy } : {}),
    ...(error ? { "aria-invalid": true as const } : {}),
    ...(required ? { required: true } : {}),
  };

  return (
    <div className={clsx("flex flex-col gap-1.5", className)}>
      <label htmlFor={controlId} className="flex items-baseline gap-1.5 text-[13px] font-medium text-ink2">
        <span>{label}</span>
        {required ? (
          <span className="text-danger" title={t(dict, "common.required")} aria-hidden="true">
            *
          </span>
        ) : null}
        {optional && !required ? (
          <span className="text-xs font-normal text-muted">({t(dict, "common.optional")})</span>
        ) : null}
      </label>

      {typeof children === "function" ? children(control) : children}

      {hint ? (
        <p id={hintId} className="text-xs text-muted">
          {hint}
        </p>
      ) : null}

      {error ? (
        <p id={errorId} className="text-xs font-medium text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}

/** Repli d'identifiant lorsque ni `id` ni `htmlFor` ne sont fournis. */
function slugify(label: string): string {
  const slug = label
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug.length > 0 ? `field-${slug}` : "field";
}
