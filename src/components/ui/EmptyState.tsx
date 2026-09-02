import { clsx } from "clsx";
import type { ReactNode } from "react";
import { getDictionary, t, type Locale } from "@/lib/i18n";

export type EmptyStateProps = {
  /** SVG inline ; une icône neutre est utilisée par défaut. */
  icon?: ReactNode;
  title?: string;
  description?: string;
  /** Bouton ou lien principal. */
  action?: ReactNode;
  /** Piste secondaire (« ou importez un fichier »). */
  secondaryAction?: ReactNode;
  /** Variante compacte pour l'intérieur d'une carte ou d'un tableau. */
  compact?: boolean;
  className?: string;
  locale?: Locale;
};

export function EmptyState({
  icon,
  title,
  description,
  action,
  secondaryAction,
  compact = false,
  className,
  locale = "fr",
}: EmptyStateProps) {
  const dict = getDictionary(locale);

  return (
    <div
      className={clsx(
        "flex flex-col items-center justify-center text-center",
        compact ? "gap-2 px-4 py-8" : "gap-3 px-6 py-14",
        className,
      )}
    >
      <span
        aria-hidden="true"
        className={clsx(
          "flex items-center justify-center rounded-full border border-line bg-surface2 text-muted",
          compact ? "h-9 w-9 [&>svg]:h-4 [&>svg]:w-4" : "h-12 w-12 [&>svg]:h-5 [&>svg]:w-5",
        )}
      >
        {icon ?? <DefaultIcon />}
      </span>

      <div className="max-w-sm">
        <p className={clsx("font-semibold text-ink", compact ? "text-sm" : "text-base")}>
          {title ?? t(dict, "empty.title")}
        </p>
        <p className="mt-1 text-sm leading-relaxed text-muted">
          {description ?? t(dict, "empty.description")}
        </p>
      </div>

      {action || secondaryAction ? (
        <div className="mt-1 flex flex-wrap items-center justify-center gap-2">
          {action}
          {secondaryAction}
        </div>
      ) : null}
    </div>
  );
}

function DefaultIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8Z" />
      <path d="M14 3v5h5" />
      <path d="M9 13h6" />
      <path d="M9 17h4" />
    </svg>
  );
}
