import { clsx } from "clsx";
import type { InputHTMLAttributes } from "react";

export type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  /** Aligne le contenu à droite et active les chiffres tabulaires. */
  numeric?: boolean;
};

export const CONTROL_CLASS =
  "block w-full rounded-md border border-line bg-surface px-2.5 text-sm text-ink " +
  "transition-colors placeholder:text-muted " +
  "hover:border-[var(--muted)] " +
  "disabled:cursor-not-allowed disabled:bg-surface2 disabled:text-muted " +
  "read-only:bg-surface2 " +
  "aria-[invalid=true]:border-danger";

export function Input({ numeric = false, className, ...props }: InputProps) {
  return (
    <input
      className={clsx(CONTROL_CLASS, "h-9", numeric && "text-end tabular", className)}
      {...props}
    />
  );
}
