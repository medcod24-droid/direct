import { clsx } from "clsx";
import type { ReactNode } from "react";

export type PageHeaderProps = {
  title: string;
  subtitle?: ReactNode;
  /** Boutons alignés à droite (à la fin en RTL). */
  actions?: ReactNode;
  /** Fil d'Ariane ou badge de contexte, au-dessus du titre. */
  eyebrow?: ReactNode;
  /** Filtres ou onglets collés sous l'en-tête. */
  children?: ReactNode;
  className?: string;
};

export function PageHeader({ title, subtitle, actions, eyebrow, children, className }: PageHeaderProps) {
  return (
    <header className={clsx("border-b border-line pb-4", className)}>
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
        <div className="min-w-0">
          {eyebrow ? <div className="mb-1 text-xs font-medium text-muted">{eyebrow}</div> : null}
          <h1 className="truncate text-lg font-semibold tracking-tight text-ink">{title}</h1>
          {subtitle ? <p className="mt-1 text-sm text-muted">{subtitle}</p> : null}
        </div>
        {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
      </div>
      {children ? <div className="mt-4">{children}</div> : null}
    </header>
  );
}
