import { clsx } from "clsx";
import type { SelectHTMLAttributes } from "react";
import { CONTROL_CLASS } from "./Input";

export type SelectOption = {
  value: string;
  label: string;
  disabled?: boolean;
};

export type SelectProps = SelectHTMLAttributes<HTMLSelectElement> & {
  /** Options déclaratives ; sinon passer des `<option>` en enfants. */
  options?: readonly SelectOption[];
  /** Première option neutre, non sélectionnable si le champ est requis. */
  placeholder?: string;
};

export function Select({ options, placeholder, className, children, ...props }: SelectProps) {
  return (
    <select
      className={clsx(
        CONTROL_CLASS,
        "h-9 cursor-pointer appearance-none bg-no-repeat pe-8",
        "[background-position:right_0.5rem_center] rtl:[background-position:left_0.5rem_center]",
        className,
      )}
      style={{
        backgroundImage:
          "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%235d7873' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")",
        backgroundSize: "1rem",
      }}
      {...props}
    >
      {placeholder !== undefined ? (
        <option value="" disabled={props.required}>
          {placeholder}
        </option>
      ) : null}
      {options?.map((option) => (
        <option key={option.value} value={option.value} disabled={option.disabled}>
          {option.label}
        </option>
      ))}
      {children}
    </select>
  );
}
