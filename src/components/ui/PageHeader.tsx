import { clsx } from "clsx";
import type { ReactNode } from "react";

export type PageHeaderProps = {
  title: string;
  subtitle?: ReactNode;
  /** Boutons alignés en fin de ligne. */
  actions?: ReactNode;
  /**
   * Sur-titre en petites capitales dorées : il situe la page dans l'exercice
   * ou dans le portefeuille avant qu'on lise le titre.
   */
  eyebrow?: ReactNode;
  /** Filtres ou onglets collés sous l'en-tête. */
  children?: ReactNode;
  className?: string;
};

/**
 * En-tête de page.
 *
 * Le sur-titre est le seul endroit où l'or porte du texte courant : il indique
 * une valeur de contexte — l'exercice, le portefeuille —, jamais un état.
 */
export function PageHeader({
  title,
  subtitle,
  actions,
  eyebrow,
  children,
  className,
}: PageHeaderProps) {
  return (
    <header className={clsx("flex flex-col gap-4", className)}>
      <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-3">
        <div className="min-w-0 flex flex-col gap-1">
          {eyebrow ? (
            <span className="text-xs font-bold uppercase tracking-[0.12em] text-gold">
              {eyebrow}
            </span>
          ) : null}
          <h1 className="truncate text-2xl font-650 text-ink">{title}</h1>
          {subtitle ? <p className="text-sm text-muted tabular">{subtitle}</p> : null}
        </div>
        {actions ? <div className="flex shrink-0 items-center gap-2.5">{actions}</div> : null}
      </div>
      {children ?? null}
    </header>
  );
}
