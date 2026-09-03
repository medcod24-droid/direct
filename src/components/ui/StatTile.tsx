import { clsx } from "clsx";
import type { ReactNode } from "react";

/**
 * Deux vocabulaires acceptés pour la même échelle : les noms de couleur
 * (`red`/`amber`/`green`, alignés sur `Badge`) et leurs alias sémantiques
 * (`danger`/`warning`/`success`). Ils sont normalisés en interne.
 */
export type StatTone =
  | "neutral"
  | "accent"
  | "red"
  | "amber"
  | "green"
  | "danger"
  | "warning"
  | "success";

type BaseTone = "neutral" | "accent" | "red" | "amber" | "green";

const TONE_ALIASES: Record<StatTone, BaseTone> = {
  neutral: "neutral",
  accent: "accent",
  red: "red",
  amber: "amber",
  green: "green",
  danger: "red",
  warning: "amber",
  success: "green",
};
export type DeltaDirection = "up" | "down" | "flat";

export type StatTileProps = {
  label: string;
  /** Déjà formaté (montant, compteur, pourcentage) — voir `@/lib/format`. */
  value: ReactNode;
  /** Précision sous la valeur : « sur 34 échéances ». */
  hint?: string;
  delta?: {
    label: string;
    direction: DeltaDirection;
    /** `true` quand une baisse est une bonne nouvelle (retards, impayés). */
    invert?: boolean;
  };
  tone?: StatTone;
  /** Rend la tuile cliquable si un href est fourni. */
  href?: string;
  className?: string;
};

const VALUE_TONE: Record<BaseTone, string> = {
  neutral: "text-ink",
  accent: "text-accent",
  red: "text-danger",
  amber: "text-warn",
  green: "text-ok",
};

const ACCENT_BAR: Record<BaseTone, string> = {
  neutral: "bg-line",
  accent: "bg-accent",
  red: "bg-danger",
  amber: "bg-warn",
  green: "bg-ok",
};

export function StatTile({ label, value, hint, delta, tone = "neutral", href, className }: StatTileProps) {
  const base = TONE_ALIASES[tone];
  const body = (
    <>
      <span aria-hidden="true" className={clsx("absolute inset-y-0 start-0 w-0.5", ACCENT_BAR[base])} />
      <p className="text-xs font-medium uppercase tracking-wide text-muted">{label}</p>
      <p className={clsx("mt-1.5 text-2xl font-semibold leading-none tabular", VALUE_TONE[base])}>
        {value}
      </p>
      {delta || hint ? (
        <p className="mt-2 flex items-start gap-1.5 text-xs text-muted">
          {delta ? <Delta {...delta} /> : null}
          {hint ? <span className="line-clamp-2">{hint}</span> : null}
        </p>
      ) : null}
    </>
  );

  const shell =
    "relative overflow-hidden rounded-lg border border-line bg-surface p-3.5 shadow-card";

  if (href) {
    return (
      <a href={href} className={clsx(shell, "block transition-colors hover:bg-surface2", className)}>
        {body}
      </a>
    );
  }

  return <div className={clsx(shell, className)}>{body}</div>;
}

function Delta({ label, direction, invert = false }: NonNullable<StatTileProps["delta"]>) {
  const good = direction === "flat" ? null : invert ? direction === "down" : direction === "up";
  const color = good === null ? "text-muted" : good ? "text-ok" : "text-danger";

  return (
    <span className={clsx("inline-flex items-center gap-1 font-medium tabular", color)}>
      <svg
        aria-hidden="true"
        width="12"
        height="12"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {direction === "up" ? <path d="M12 19V5M5 12l7-7 7 7" /> : null}
        {direction === "down" ? <path d="M12 5v14M5 12l7 7 7-7" /> : null}
        {direction === "flat" ? <path d="M5 12h14" /> : null}
      </svg>
      {label}
    </span>
  );
}
