import { clsx } from "clsx";
import type { ReactNode } from "react";

export type CardProps = {
  title?: ReactNode;
  /** Zone d'actions alignée à droite de l'en-tête. */
  action?: ReactNode;
  description?: ReactNode;
  footer?: ReactNode;
  /** Désactiver pour coller un tableau bord à bord dans la carte. */
  padded?: boolean;
  className?: string;
  bodyClassName?: string;
  children?: ReactNode;
};

export function Card({
  title,
  action,
  description,
  footer,
  padded = true,
  className,
  bodyClassName,
  children,
}: CardProps) {
  const hasHeader = title !== undefined || action !== undefined || description !== undefined;

  return (
    <section className={clsx("rounded-lg border border-line bg-surface shadow-card", className)}>
      {hasHeader ? (
        <header className="flex items-start justify-between gap-3 border-b border-line px-4 py-3">
          <div className="min-w-0">
            {title !== undefined ? (
              <h2 className="truncate text-sm font-semibold text-ink">{title}</h2>
            ) : null}
            {description !== undefined ? (
              <p className="mt-0.5 text-xs text-muted">{description}</p>
            ) : null}
          </div>
          {action !== undefined ? <div className="shrink-0">{action}</div> : null}
        </header>
      ) : null}

      <div className={clsx(padded && "p-4", bodyClassName)}>{children}</div>

      {footer !== undefined ? (
        <footer className="border-t border-line px-4 py-2.5 text-xs text-muted">{footer}</footer>
      ) : null}
    </section>
  );
}
