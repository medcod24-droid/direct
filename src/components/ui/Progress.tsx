import { clsx } from "clsx";

/**
 * Indicateurs d'avancement.
 *
 * Règle du produit : aucun ensemble à plusieurs états ne s'affiche sans dire où
 * il en est, et **aucun compteur ne s'affiche sans son total** — « 7 » ne veut
 * rien dire, « 7 sur 34 » oui.
 */

export type Segment = {
  label: string;
  value: number;
  /** Classe de fond du segment ; les tons de conformité sont attendus. */
  className: string;
};

export type SegmentedProgressProps = {
  segments: readonly Segment[];
  /** Total de référence ; les segments qui n'y arrivent pas laissent un reste. */
  total?: number;
  /** Hauteur de la barre : 7 dans une ligne de liste, 10 en tête de section. */
  height?: 4 | 7 | 8 | 10;
  /** Masque la légende quand la place manque ; les titres restent en infobulle. */
  legend?: boolean;
  className?: string;
  label?: string;
};

/**
 * Barre segmentée : une part par état, dans l'ordre de progression.
 *
 * La légende porte les compteurs, pas seulement les couleurs : une information
 * ne doit jamais tenir à la seule couleur.
 */
export function SegmentedProgress({
  segments,
  total,
  height = 7,
  legend = true,
  className,
  label,
}: SegmentedProgressProps) {
  const sum = segments.reduce((acc, segment) => acc + Math.max(0, segment.value), 0);
  const base = Math.max(total ?? sum, 1);

  return (
    <div className={clsx("grid gap-1.5", className)}>
      <div
        className={clsx(
          "flex overflow-hidden rounded-full bg-surface2",
          height === 4 && "h-1",
          height === 7 && "h-[7px]",
          height === 8 && "h-2",
          height === 10 && "h-2.5",
        )}
        role="img"
        aria-label={
          label ??
          segments.map((segment) => `${segment.label} ${segment.value} sur ${base}`).join(", ")
        }
      >
        {segments.map((segment) =>
          segment.value > 0 ? (
            <span
              key={segment.label}
              className={segment.className}
              style={{ width: `${(segment.value / base) * 100}%` }}
              title={`${segment.label} : ${segment.value} sur ${base}`}
            />
          ) : null,
        )}
      </div>

      {legend ? (
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-2xs text-muted tabular">
          {segments.map((segment) => (
            <span key={segment.label} className="inline-flex items-center gap-1.5">
              <span
                aria-hidden="true"
                className={clsx("h-2 w-2 shrink-0 rounded-sm", segment.className)}
              />
              {segment.label} {segment.value}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export type ProgressBarProps = {
  value: number;
  total: number;
  /** Ton de la part remplie. */
  tone?: "accent" | "ok" | "warn" | "danger" | "gold";
  height?: 4 | 7 | 10;
  className?: string;
  label?: string;
};

const TONE_BG: Record<string, string> = {
  accent: "bg-accent",
  ok: "bg-ok",
  warn: "bg-warn",
  danger: "bg-danger",
  gold: "bg-gold",
};

/** Barre simple. Utilisée pour un reste à courir : temps, complétude, dépôts. */
export function ProgressBar({
  value,
  total,
  tone = "accent",
  height = 4,
  className,
  label,
}: ProgressBarProps) {
  const ratio = total > 0 ? Math.min(1, Math.max(0, value / total)) : 0;
  return (
    <span
      className={clsx(
        "block overflow-hidden rounded-full bg-surface2",
        height === 4 && "h-1",
        height === 7 && "h-[7px]",
        height === 10 && "h-2.5",
        className,
      )}
      role="img"
      aria-label={label ?? `${value} sur ${total}`}
    >
      <span
        className={clsx("block h-full rounded-full", TONE_BG[tone])}
        style={{ width: `${ratio * 100}%` }}
      />
    </span>
  );
}

export type GaugeProps = {
  /** Part réalisée, entre 0 et 1. */
  ratio: number;
  /** Mot d'état sous le pourcentage : CONFORME, À SURVEILLER… */
  caption?: string;
  size?: number;
  tone?: "gold" | "accent" | "ok" | "warn" | "danger";
  className?: string;
};

const TONE_STROKE: Record<string, string> = {
  gold: "var(--gold)",
  accent: "var(--accent)",
  ok: "var(--green)",
  warn: "var(--amber)",
  danger: "var(--red)",
};

/**
 * Jauge radiale.
 *
 * SVG écrit à la main : aucune bibliothèque de graphiques, donc rien à charger
 * depuis un CDN, et la jauge s'imprime avec la page. L'arc part de midi
 * (rotation de -90°) parce qu'une progression se lit en partant du haut.
 */
export function Gauge({ ratio, caption, size = 132, tone = "gold", className }: GaugeProps) {
  const bounded = Math.min(1, Math.max(0, ratio));
  const radius = size / 2 - size * 0.09;
  const circumference = 2 * Math.PI * radius;
  const percent = Math.round(bounded * 100);

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className={clsx("shrink-0", className)}
      role="img"
      aria-label={`${percent} %${caption ? ` — ${caption}` : ""}`}
    >
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="var(--surface-2)"
        strokeWidth={size * 0.098}
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke={TONE_STROKE[tone]}
        strokeWidth={size * 0.098}
        strokeLinecap="round"
        strokeDasharray={`${circumference * bounded} ${circumference}`}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
      <text
        x={size / 2}
        y={size / 2 - size * 0.022}
        textAnchor="middle"
        fill="var(--ink)"
        fontSize={size * 0.227}
        fontWeight={650}
        style={{ fontVariantNumeric: "tabular-nums" }}
      >
        {percent} %
      </text>
      {caption ? (
        <text
          x={size / 2}
          y={size / 2 + size * 0.121}
          textAnchor="middle"
          fill="var(--muted)"
          fontSize={size * 0.087}
          letterSpacing="1.2"
        >
          {caption}
        </text>
      ) : null}
    </svg>
  );
}

export type DeltaPillProps = {
  /** Texte de la variation, déjà formaté : « 12 % », « 3 dossiers ». */
  value: string;
  direction: "up" | "down" | "flat";
  /**
   * Sens métier de la hausse. Pour un retard, monter est mauvais : le ton ne
   * peut donc pas se déduire de la seule direction.
   */
  good?: boolean;
  className?: string;
};

/** Pastille de variation, avec sa flèche. */
export function DeltaPill({ value, direction, good = true, className }: DeltaPillProps) {
  const positive = direction === "up" ? good : direction === "down" ? !good : true;
  const tone =
    direction === "flat"
      ? "bg-surface2 text-muted"
      : positive
        ? "bg-okSoft text-ok"
        : "bg-dangerSoft text-danger";

  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-bold tabular",
        tone,
        className,
      )}
    >
      {direction !== "flat" ? (
        <svg
          width={13}
          height={13}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2.4}
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          {direction === "up" ? (
            <>
              <path d="M12 19.2V5.4" />
              <path d="m6.4 11 5.6-5.6L17.6 11" />
            </>
          ) : (
            <>
              <path d="M12 4.8v13.8" />
              <path d="m6.4 13 5.6 5.6L17.6 13" />
            </>
          )}
        </svg>
      ) : null}
      {value}
    </span>
  );
}

export type CountBadgeProps = {
  value: number;
  tone?: "neutral" | "accent" | "danger" | "warn" | "ok" | "gold";
  className?: string;
};

const COUNT_TONES: Record<string, string> = {
  neutral: "bg-surface2 text-muted",
  accent: "bg-accentSoft text-accent",
  danger: "bg-dangerSoft text-danger",
  warn: "bg-warnSoft text-warn",
  ok: "bg-okSoft text-ok",
  gold: "bg-goldSoft text-gold",
};

/** Compteur compact : navigation, onglets, en-têtes de section. */
export function CountBadge({ value, tone = "neutral", className }: CountBadgeProps) {
  return (
    <span
      className={clsx(
        "inline-flex min-w-[22px] justify-center rounded-full px-1.5 py-0.5 text-2xs font-bold tabular",
        COUNT_TONES[tone],
        className,
      )}
    >
      {value}
    </span>
  );
}
