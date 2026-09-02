"use client";

import { clsx } from "clsx";
import { useCallback, useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";

export type TabItem = {
  id: string;
  label: string;
  /** Compteur discret à droite du libellé (nombre de lignes, d'alertes…). */
  count?: number;
  disabled?: boolean;
  content?: ReactNode;
};

export type TabsProps = {
  items: readonly TabItem[];
  /** Onglet actif au premier rendu ; par défaut le premier non désactivé. */
  defaultTabId?: string;
  /** Passe en mode contrôlé lorsqu'il est fourni. */
  activeTabId?: string;
  onChange?: (id: string) => void;
  className?: string;
  panelClassName?: string;
  label?: string;
};

export function Tabs({
  items,
  defaultTabId,
  activeTabId,
  onChange,
  className,
  panelClassName,
  label,
}: TabsProps) {
  const baseId = useId();
  const listRef = useRef<HTMLDivElement | null>(null);
  const firstEnabled = items.find((item) => !item.disabled)?.id ?? items[0]?.id ?? "";
  const [internalId, setInternalId] = useState(defaultTabId ?? firstEnabled);

  const current = activeTabId ?? internalId;

  const select = useCallback(
    (id: string) => {
      if (activeTabId === undefined) setInternalId(id);
      onChange?.(id);
    },
    [activeTabId, onChange],
  );

  // Flèches, Début et Fin déplacent le focus ; la direction suit le sens
  // d'écriture réel du conteneur (RTL en arabe).
  const onKeyDown = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      const keys = ["ArrowRight", "ArrowLeft", "Home", "End"];
      if (!keys.includes(event.key)) return;

      const enabled = items.filter((item) => !item.disabled);
      if (enabled.length === 0) return;

      const rtl =
        listRef.current !== null &&
        typeof window !== "undefined" &&
        window.getComputedStyle(listRef.current).direction === "rtl";

      const index = Math.max(0, enabled.findIndex((item) => item.id === current));
      let nextIndex = index;

      if (event.key === "Home") nextIndex = 0;
      else if (event.key === "End") nextIndex = enabled.length - 1;
      else {
        const forward = rtl ? event.key === "ArrowLeft" : event.key === "ArrowRight";
        nextIndex = (index + (forward ? 1 : -1) + enabled.length) % enabled.length;
      }

      const next = enabled[nextIndex];
      if (!next) return;

      event.preventDefault();
      select(next.id);
      listRef.current?.querySelector<HTMLButtonElement>(`#${CSS.escape(`${baseId}-tab-${next.id}`)}`)?.focus();
    },
    [baseId, current, items, select],
  );

  const active = items.find((item) => item.id === current);

  return (
    <div className={className}>
      <div
        ref={listRef}
        role="tablist"
        aria-label={label}
        onKeyDown={onKeyDown}
        className="flex items-center gap-1 overflow-x-auto border-b border-line"
      >
        {items.map((item) => {
          const selected = item.id === current;
          return (
            <button
              key={item.id}
              type="button"
              role="tab"
              id={`${baseId}-tab-${item.id}`}
              aria-selected={selected}
              aria-controls={`${baseId}-panel-${item.id}`}
              tabIndex={selected ? 0 : -1}
              disabled={item.disabled}
              onClick={() => select(item.id)}
              className={clsx(
                "-mb-px inline-flex items-center gap-2 whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium transition-colors",
                "disabled:cursor-not-allowed disabled:opacity-45",
                selected
                  ? "border-accent text-accent"
                  : "border-transparent text-muted hover:border-line hover:text-ink",
              )}
            >
              {item.label}
              {item.count !== undefined ? (
                <span
                  className={clsx(
                    "rounded-full px-1.5 py-0.5 text-[11px] font-semibold tabular",
                    selected ? "bg-accentSoft text-accent" : "bg-surface2 text-muted",
                  )}
                >
                  {item.count}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

      {active?.content !== undefined ? (
        <div
          role="tabpanel"
          id={`${baseId}-panel-${active.id}`}
          aria-labelledby={`${baseId}-tab-${active.id}`}
          tabIndex={0}
          className={clsx("pt-4", panelClassName)}
        >
          {active.content}
        </div>
      ) : null}
    </div>
  );
}
