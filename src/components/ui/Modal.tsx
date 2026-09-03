"use client";

import { clsx } from "clsx";
import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { getDictionary, t, type Locale } from "@/lib/i18n";

export type ModalSize = "sm" | "md" | "lg";

export type ModalProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  /** Barre d'actions en pied de fenêtre. */
  footer?: ReactNode;
  size?: ModalSize;
  /** Empêche la fermeture par Échap ou par clic sur le fond. */
  dismissible?: boolean;
  locale?: Locale;
  className?: string;
  children?: ReactNode;
};

const SIZES: Record<ModalSize, string> = {
  sm: "max-w-md",
  md: "max-w-xl",
  lg: "max-w-3xl",
};

export function Modal({
  open,
  onClose,
  title,
  description,
  footer,
  size = "md",
  dismissible = true,
  locale = "fr",
  className,
  children,
}: ModalProps) {
  const dict = getDictionary(locale);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const restoreRef = useRef<HTMLElement | null>(null);
  // `document` n'existe pas au rendu serveur : le portail attend le montage.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const headingId = useId();
  const descriptionId = useId();

  const requestClose = useCallback(() => {
    if (dismissible) onClose();
  }, [dismissible, onClose]);

  // Échap ferme la fenêtre ; le focus part sur le panneau puis revient
  // à l'élément qui l'a ouverte.
  useEffect(() => {
    if (!open) return;

    restoreRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    panelRef.current?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        requestClose();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
      restoreRef.current?.focus();
    };
  }, [open, requestClose]);

  if (!open || !mounted) return null;

  // Rendu à la racine du document, jamais à l'endroit où le composant est appelé.
  // Une boîte de dialogue déclarée dans une cellule de tableau héritait sinon de
  // son style : `white-space: nowrap` sur la cellule empêchait le texte de la
  // fenêtre de revenir à la ligne. Le portail règle aussi les cas d'ancêtre à
  // `transform` ou `overflow`, qui piègent un élément `position: fixed`.
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto whitespace-normal p-4 sm:p-8">
      <div
        aria-hidden="true"
        onClick={requestClose}
        className="fixed inset-0 bg-[var(--overlay)]"
      />

      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={headingId}
        aria-describedby={description ? descriptionId : undefined}
        tabIndex={-1}
        className={clsx(
          "relative z-10 my-auto w-full rounded-xl border border-line bg-surface shadow-panel outline-none",
          SIZES[size],
          className,
        )}
      >
        <header className="flex items-start justify-between gap-3 border-b border-line px-4 py-3">
          <div className="min-w-0">
            <h2 id={headingId} className="text-sm font-semibold text-ink">
              {title}
            </h2>
            {description ? (
              <p id={descriptionId} className="mt-0.5 text-xs text-muted">
                {description}
              </p>
            ) : null}
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label={t(dict, "a11y.closeDialog")}
            className="-me-1 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted transition-colors hover:bg-surface2 hover:text-ink"
          >
            <svg
              aria-hidden="true"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            >
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </header>

        <div className="px-4 py-4 text-sm text-ink2">{children}</div>

        {footer ? (
          <footer className="flex items-center justify-end gap-2 border-t border-line px-4 py-3">
            {footer}
          </footer>
        ) : null}
      </div>
    </div>,
    document.body,
  );
}
