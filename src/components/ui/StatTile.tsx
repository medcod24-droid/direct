import { clsx } from "clsx";
import type { ReactNode } from "react";
import Link from "next/link";
import { DeltaPill } from "./Progress";
import { IconChip, type ChipTone, type IconName } from "./Icon";

export type StatTone = "neutral" | "accent" | "gold" | "success" | "warning" | "danger";
export type DeltaDirection = "up" | "down" | "flat";

export type StatTileProps = {
  label: string;
  value: ReactNode;
  /** Ligne sous la valeur : le total de référence, quand il y en a un. */
  over?: ReactNode;
  /** Pied de tuile : la comparaison avec la période précédente. */
  compare?: ReactNode;
  icon?: IconName;
  tone?: StatTone;
  /** Variation affichée en pastille, déjà formatée. */
  delta?: string;
  deltaDirection?: DeltaDirection;
  /** Une hausse est-elle une bonne nouvelle ? Faux pour un retard. */
  deltaGood?: boolean;
  href?: string;
  className?: string;
};

const VALUE_TONES: Record<StatTone, string> = {
  neutral: "text-ink",
  accent: "text-ink",
  gold: "text-gold",
  success: "text-ok",
  warning: "text-warn",
  danger: "text-danger",
};

const CHIP_TONES: Record<StatTone, ChipTone> = {
  neutral: "neutral",
  accent: "accent",
  gold: "gold",
  success: "ok",
  warning: "warn",
  danger: "danger",
};

/**
 * Carte de KPI.
 *
 * Quatre étages, toujours dans le même ordre : la puce d'icône et la variation,
 * le libellé en petites capitales, le nombre — très grand, en chiffres
 * tabulaires — puis son total, et enfin la comparaison, séparée par un filet.
 *
 * Le nombre seul ne suffit pas : `over` porte le total (« sur 34 ») et `compare`
 * la période précédente. Un compteur sans référence ne se lit pas.
 */
export function StatTile({
  label,
  value,
  over,
  compare,
  icon,
  tone = "neutral",
  delta,
  deltaDirection = "flat",
  deltaGood = true,
  href,
  className,
}: StatTileProps) {
  const body = (
    <>
      <div className="flex items-start justify-between gap-2.5">
        {icon ? <IconChip name={icon} tone={CHIP_TONES[tone]} size={34} /> : <span />}
        {delta ? (
          <DeltaPill value={delta} direction={deltaDirection} good={deltaGood} />
        ) : null}
      </div>

      <div className="flex flex-col gap-0.5">
        <span className="text-2xs font-bold uppercase tracking-[0.12em] text-muted">{label}</span>
        <span className={clsx("text-4xl font-650 tabular", VALUE_TONES[tone])}>{value}</span>
        {over !== undefined ? (
          <span className="text-xs text-ink2 tabular">{over}</span>
        ) : null}
      </div>

      {compare !== undefined ? (
        <span className="border-t border-line pt-2 text-xs text-muted tabular">{compare}</span>
      ) : null}
    </>
  );

  const shell = clsx(
    "flex flex-col gap-3 rounded-card border border-line bg-surface p-4 shadow-edge",
    href && "transition-colors hover:border-[var(--muted)]",
    className,
  );

  return href ? (
    <Link href={href} className={shell}>
      {body}
    </Link>
  ) : (
    <div className={shell}>{body}</div>
  );
}
