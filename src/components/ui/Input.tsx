import { clsx } from "clsx";
import type { InputHTMLAttributes } from "react";

export type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  /** Aligne le contenu à droite et active les chiffres tabulaires. */
  numeric?: boolean;
};

export const CONTROL_CLASS =
  "block w-full rounded-control border border-line bg-bg px-3 text-sm text-ink " +
  "transition-colors placeholder:text-muted " +
  "hover:border-[var(--muted)] " +
  "focus:border-accent focus:outline-none focus:ring-2 focus:ring-accentSoft " +
  "disabled:cursor-not-allowed disabled:bg-surface2 disabled:text-muted " +
  "read-only:bg-surface2 " +
  "aria-[invalid=true]:border-danger aria-[invalid=true]:ring-dangerSoft";

export function Input({ numeric = false, className, ...props }: InputProps) {
  return (
    <input
      className={clsx(CONTROL_CLASS, "h-[38px]", numeric && "text-end tabular", className)}
      {...props}
    />
  );
}
