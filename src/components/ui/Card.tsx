import { clsx } from "clsx";
import type { ReactNode } from "react";
import { IconChip, type ChipTone, type IconName } from "./Icon";

export type CardProps = {
  title?: ReactNode;
  /** Puce d'icône ouvrant l'en-tête : c'est le motif de toutes les cartes. */
  icon?: IconName;
  iconTone?: ChipTone;
  /** Zone d'actions alignée en fin d'en-tête. */
  action?: ReactNode;
  /** Ligne secondaire de l'en-tête. Y placer le compteur et son total. */
  description?: ReactNode;
  footer?: ReactNode;
  /** Désactiver pour coller un tableau bord à bord dans la carte. */
  padded?: boolean;
  /** Retire la bordure sous l'en-tête, quand le corps enchaîne visuellement. */
  seamless?: boolean;
  className?: string;
  bodyClassName?: string;
  children?: ReactNode;
};

/**
 * Carte.
 *
 * La profondeur vient de la bordure et du liseré supérieur (`shadow-edge`), pas
 * d'une ombre portée : sur un fond sombre une ombre ne se voit pas, et sur un
 * fond clair elle salit la page.
 */
export function Card({
  title,
  icon,
  iconTone = "accent",
  action,
  description,
  footer,
  padded = true,
  seamless = false,
  className,
  bodyClassName,
  children,
}: CardProps) {
  const hasHeader =
    title !== undefined || action !== undefined || description !== undefined || icon !== undefined;

  return (
    <section
      className={clsx(
        "rounded-card border border-line bg-surface shadow-edge",
        className,
      )}
    >
      {hasHeader ? (
        <header
          className={clsx(
            "flex items-center gap-2.5 px-4 py-3.5",
            !seamless && !padded && "border-b border-line",
          )}
        >
          {icon ? <IconChip name={icon} tone={iconTone} size={32} /> : null}
          <div className="min-w-0 flex flex-col">
            {title !== undefined ? (
              <h2 className="truncate text-md font-650 text-ink">{title}</h2>
            ) : null}
            {description !== undefined ? (
              <p className="text-xs text-muted tabular">{description}</p>
            ) : null}
          </div>
          {action !== undefined ? (
            <div className="ms-auto shrink-0">{action}</div>
          ) : null}
        </header>
      ) : null}

      <div className={clsx(padded && (hasHeader ? "px-4 pb-4" : "p-4"), bodyClassName)}>
        {children}
      </div>

      {footer !== undefined ? (
        <footer className="border-t border-line px-4 py-2.5 text-xs text-muted">{footer}</footer>
      ) : null}
    </section>
  );
}
