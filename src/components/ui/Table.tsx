import { clsx } from "clsx";
import type {
  HTMLAttributes,
  TdHTMLAttributes,
  ThHTMLAttributes,
} from "react";

/** Surface encadrée qui contient un tableau. Elle rogne le débordement :
 *  c'est le tableau qui défile à l'intérieur, jamais la page. */
export function TableWrap({ className, children, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={clsx(
        "w-full overflow-hidden rounded-lg border border-line bg-surface",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export type TableProps = HTMLAttributes<HTMLTableElement> & {
  /**
   * Largeur minimale du tableau : en dessous, c'est l'enveloppe qui défile
   * horizontalement — jamais la page.
   */
  minWidth?: number;
  wrapperClassName?: string;
  /** Libellé lu par les lecteurs d'écran (obligatoire si pas de `<caption>`). */
  label?: string;
};

/** Le tableau porte toujours sa propre enveloppe de défilement horizontal,
 *  qu'il soit ou non placé dans un `TableWrap`. */
export function Table({
  minWidth = 720,
  wrapperClassName,
  label,
  className,
  children,
  ...props
}: TableProps) {
  return (
    <div className={clsx("scroll-x w-full", wrapperClassName)}>
      <table
        aria-label={label}
        style={{ minWidth }}
        className={clsx("w-full text-sm", className)}
        {...props}
      >
        {children}
      </table>
    </div>
  );
}

export function THead({ className, children, ...props }: HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <thead className={clsx("bg-surface2 text-ink2", className)} {...props}>
      {children}
    </thead>
  );
}

export function TBody({ className, children, ...props }: HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <tbody className={clsx(className)} {...props}>
      {children}
    </tbody>
  );
}

export type TRProps = HTMLAttributes<HTMLTableRowElement> & {
  /** Surbrillance au survol : à réserver aux lignes réellement cliquables. */
  interactive?: boolean;
};

export function TR({ interactive = false, className, children, ...props }: TRProps) {
  return (
    <tr
      className={clsx(
        "border-b border-line last:border-b-0",
        interactive && "cursor-pointer transition-colors hover:bg-surface2",
        className,
      )}
      {...props}
    >
      {children}
    </tr>
  );
}

export type THProps = ThHTMLAttributes<HTMLTableCellElement> & {
  /** Colonne de chiffres : alignée à droite et en chiffres tabulaires. */
  numeric?: boolean;
};

export function TH({ numeric = false, scope = "col", className, children, ...props }: THProps) {
  return (
    <th
      scope={scope}
      className={clsx(
        "px-3 py-2 text-start text-xs font-semibold uppercase tracking-wide text-muted",
        numeric && "text-end tabular",
        className,
      )}
      {...props}
    >
      {children}
    </th>
  );
}

export type TDProps = TdHTMLAttributes<HTMLTableCellElement> & {
  numeric?: boolean;
};

export function TD({ numeric = false, className, children, ...props }: TDProps) {
  return (
    <td
      className={clsx(
        "px-3 py-2 align-middle text-ink",
        numeric && "text-end tabular",
        className,
      )}
      {...props}
    >
      {children}
    </td>
  );
}
