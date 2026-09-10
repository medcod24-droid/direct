import { clsx } from "clsx";
import type { ReactNode } from "react";

/**
 * Jeu d'icônes du produit.
 *
 * Tracés en ligne, jamais chargés depuis un CDN : la politique de sécurité
 * (`default-src 'self'`) bloque toute police d'icônes distante, et une icône qui
 * ne se charge pas laisse un bouton muet.
 *
 * Toutes les icônes partagent la même grille de 24, un trait de 1,75 px et
 * `currentColor` : elles prennent la couleur du texte qui les entoure, ce qui
 * les rend justes dans les deux thèmes sans réglage.
 */
const PATHS: Record<string, ReactNode> = {
  dash: (
    <>
      <rect x="3.2" y="3.2" width="7.2" height="7.2" rx="1.6"></rect><rect x="13.6" y="3.2" width="7.2" height="7.2" rx="1.6"></rect><rect x="3.2" y="13.6" width="7.2" height="7.2" rx="1.6"></rect><rect x="13.6" y="13.6" width="7.2" height="7.2" rx="1.6"></rect>
    </>
  ),
  clients: (
    <>
      <circle cx="9.5" cy="8" r="3.3"></circle><path d="M3.5 20c.7-3.4 3-5.1 6-5.1s5.3 1.7 6 5.1"></path><path d="M16.8 7.2a3 3 0 0 1 0 5.6"></path><path d="M18.4 15.6c1.6.7 2.6 2 3 4.4"></path>
    </>
  ),
  calendar: (
    <>
      <rect x="3.2" y="5" width="17.6" height="15.8" rx="2.6"></rect><path d="M8 3.2v3.6M16 3.2v3.6M3.2 10h17.6"></path>
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="8.4"></circle><path d="M12 7.4V12l3.2 2"></path>
    </>
  ),
  task: (
    <>
      <rect x="3.4" y="3.4" width="17.2" height="17.2" rx="3.2"></rect><path d="m8 12.2 2.9 2.9 5.4-6"></path>
    </>
  ),
  chart: (
    <>
      <path d="M4 3.6v16.8h16.4"></path><rect x="7.2" y="12" width="3.4" height="5.2" rx="1.1"></rect><rect x="13.4" y="7.6" width="3.4" height="9.6" rx="1.1"></rect>
    </>
  ),
  doc: (
    <>
      <path d="M6 3.6h7.6L19 9.2v11.2H6z"></path><path d="M13.6 3.6v5.6H19"></path><path d="M9 13.2h7M9 16.6h5"></path>
    </>
  ),
  inbox: (
    <>
      <path d="M3.6 13.6h4.2l1.4 2.8h5.6l1.4-2.8h4.2"></path><path d="M3.6 13.6 6.2 5.2h11.6l2.6 8.4v4.8a2 2 0 0 1-2 2H5.6a2 2 0 0 1-2-2z"></path>
    </>
  ),
  coins: (
    <>
      <ellipse cx="8.8" cy="6.6" rx="5.2" ry="2.5"></ellipse><path d="M3.6 6.6v4.2c0 1.4 2.3 2.5 5.2 2.5"></path><ellipse cx="15.2" cy="14" rx="5.2" ry="2.5"></ellipse><path d="M10 14v3.6c0 1.4 2.3 2.5 5.2 2.5s5.2-1.1 5.2-2.5V14"></path>
    </>
  ),
  team: (
    <>
      <circle cx="8.4" cy="8" r="3"></circle><circle cx="16.6" cy="9.4" r="2.4"></circle><path d="M2.9 19.6c.5-3 2.7-4.6 5.5-4.6s5 1.6 5.5 4.6"></path><path d="M15.6 14.6c2.4.2 4 1.8 4.5 4.4"></path>
    </>
  ),
  settings: (
    <>
      <path d="M3.6 7h9.2M18.4 7h2M3.6 12h3.2M11.2 12h9.2M3.6 17h8.4M16.8 17h3.6"></path><circle cx="15.4" cy="7" r="2.2"></circle><circle cx="9" cy="12" r="2.2"></circle><circle cx="14.4" cy="17" r="2.2"></circle>
    </>
  ),
  bell: (
    <>
      <path d="M6.6 16.6V10a5.4 5.4 0 0 1 10.8 0v6.6"></path><path d="M4.6 16.6h14.8"></path><path d="M10 19.4a2.2 2.2 0 0 0 4 0"></path>
    </>
  ),
  search: (
    <>
      <circle cx="10.6" cy="10.6" r="6.2"></circle><path d="m15.2 15.2 4.8 4.8"></path>
    </>
  ),
  plus: (
    <>
      <path d="M12 5.2v13.6M5.2 12h13.6"></path>
    </>
  ),
  check: (
    <>
      <path d="m5 12.6 4.6 4.6L19 7.4"></path>
    </>
  ),
  alert: (
    <>
      <path d="M12 4.4 20.8 19.6H3.2z"></path><path d="M12 10v3.8"></path><circle cx="12" cy="16.9" r=".75" fill="currentColor" stroke="none"></circle>
    </>
  ),
  print: (
    <>
      <path d="M7 9.2V4h10v5.2"></path><rect x="3.4" y="9.2" width="17.2" height="7" rx="2.2"></rect><path d="M7 13.8h10v6.4H7z"></path>
    </>
  ),
  more: (
    <>
      <circle cx="5.8" cy="12" r="1.25" fill="currentColor" stroke="none"></circle><circle cx="12" cy="12" r="1.25" fill="currentColor" stroke="none"></circle><circle cx="18.2" cy="12" r="1.25" fill="currentColor" stroke="none"></circle>
    </>
  ),
  chevronDown: (
    <>
      <path d="m6.4 9.4 5.6 5.6 5.6-5.6"></path>
    </>
  ),
  chevronRight: (
    <>
      <path d="m9.4 5.8 6.2 6.2-6.2 6.2"></path>
    </>
  ),
  star: (
    <>
      <path d="m12 3.8 2.5 5.1 5.6.8-4.1 3.9 1 5.6L12 16.5l-5 2.7 1-5.6L3.9 9.7l5.6-.8z"></path>
    </>
  ),
  up: (
    <>
      <path d="M12 19.2V5.4"></path><path d="m6.4 11 5.6-5.6L17.6 11"></path>
    </>
  ),
  down: (
    <>
      <path d="M12 4.8v13.8"></path><path d="m6.4 13 5.6 5.6L17.6 13"></path>
    </>
  ),
  x: (
    <>
      <path d="m6.4 6.4 11.2 11.2M17.6 6.4 6.4 17.6"></path>
    </>
  ),
  filter: (
    <>
      <path d="M4 6.4h16M7 12h10M10 17.6h4"></path>
    </>
  ),
  building: (
    <>
      <rect x="4.4" y="3.4" width="15.2" height="17.2" rx="2.2"></rect><path d="M8.6 8h2.2M13.2 8h2.2M8.6 12.2h2.2M13.2 12.2h2.2M10.2 20.6v-4h3.6v4"></path>
    </>
  ),
  folder: (
    <>
      <path d="M3.6 7.4a2 2 0 0 1 2-2h3.6l2 2.4h7.2a2 2 0 0 1 2 2v7.8a2 2 0 0 1-2 2h-12.8a2 2 0 0 1-2-2z"></path>
    </>
  ),
  upload: (
    <>
      <path d="M12 15.6V4.8"></path><path d="m7.6 9.2 4.4-4.4 4.4 4.4"></path><path d="M4.6 15.4v2.6a2 2 0 0 0 2 2h10.8a2 2 0 0 0 2-2v-2.6"></path>
    </>
  ),
  mail: (
    <>
      <rect x="3.4" y="5.4" width="17.2" height="13.2" rx="2.4"></rect><path d="m4.6 8 7.4 4.9L19.4 8"></path>
    </>
  ),
  phone: (
    <>
      <path d="M6 4.4h3l1.5 4-2 1.5a11.2 11.2 0 0 0 5.6 5.6l1.5-2 4 1.5v3a2 2 0 0 1-2 2C11.4 20 4 12.6 4 6.4a2 2 0 0 1 2-2z"></path>
    </>
  ),
  edit: (
    <>
      <path d="M5 19h3l9.4-9.4-3-3L5 16z"></path><path d="m14.4 4.6 3 3"></path>
    </>
  ),
  trash: (
    <>
      <path d="M4.6 7h14.8M9.6 7V4.4h4.8V7M6.8 7l1 13.2h8.4L17.2 7"></path>
    </>
  ),
  login: (
    <>
      <path d="M13.6 4.4h3.8a2 2 0 0 1 2 2v11.2a2 2 0 0 1-2 2h-3.8"></path><path d="m9.6 8.4 3.6 3.6-3.6 3.6"></path><path d="M13.2 12H4.4"></path>
    </>
  ),
  shield: (
    <>
      <path d="M12 3.4 19.4 6v6.2c0 4-3 7-7.4 8.4-4.4-1.4-7.4-4.4-7.4-8.4V6z"></path><path d="m9.2 12 2.2 2.2 4.2-4.4"></path>
    </>
  ),
  missing: (
    <>
      <rect x="5" y="3.6" width="14" height="16.8" rx="2.2" strokeDasharray="3.2 3"></rect><path d="M12 8.6v4.2"></path><circle cx="12" cy="16.2" r=".75" fill="currentColor" stroke="none"></circle>
    </>
  ),
  send: (
    <>
      <path d="M4.4 12 20 4.8l-4.2 15-4.6-5.2z"></path><path d="m11.2 14.6 8.8-9.8"></path>
    </>
  ),
  tree: (
    <>
      <path d="M6 4.4v13.2a2 2 0 0 0 2 2h2.6"></path><path d="M6 11.4h4.6"></path><rect x="10.6" y="3" width="8.4" height="3.6" rx="1.1"></rect><rect x="10.6" y="9.6" width="8.4" height="3.6" rx="1.1"></rect><rect x="10.6" y="16.2" width="8.4" height="3.6" rx="1.1"></rect>
    </>
  ),
  sun: (
    <>
      <circle cx="12" cy="12" r="4.2"></circle><path d="M12 2.6v2.4M12 19v2.4M4.6 12H2.2M21.8 12h-2.4M6.4 6.4 4.7 4.7M19.3 19.3l-1.7-1.7M17.6 6.4l1.7-1.7M4.7 19.3l1.7-1.7"></path>
    </>
  ),
  moon: (
    <>
      <path d="M20 14.4A8.4 8.4 0 0 1 9.6 4a8.6 8.6 0 1 0 10.4 10.4z"></path>
    </>
  ),
};

export type IconName = keyof typeof PATHS;

export type IconProps = {
  name: IconName;
  /** Côté du carré, en pixels. 20 dans les listes, 24 dans la navigation. */
  size?: number;
  /** Épaisseur du trait ; 2 à 2,4 pour les très petites tailles. */
  stroke?: number;
  className?: string;
  /** Titre lu par les lecteurs d'écran ; sans lui l'icône est décorative. */
  title?: string;
};

export function Icon({ name, size = 20, stroke = 1.75, className, title }: IconProps) {
  const path = PATHS[name];
  if (!path) return null;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={stroke}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={clsx("shrink-0", className)}
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
    >
      {title ? <title>{title}</title> : null}
      {path}
    </svg>
  );
}

/**
 * Puce d'icône : carré arrondi, fond teinté, glyphe coloré.
 *
 * C'est le motif d'ouverture de chaque carte et de chaque ligne de liste. Le ton
 * suit la sémantique du bloc — `accent` par défaut, `gold` pour une valeur,
 * `danger` / `warn` / `ok` pour un état de conformité.
 */
export type ChipTone = "accent" | "gold" | "danger" | "warn" | "ok" | "neutral";

const CHIP_TONES: Record<ChipTone, string> = {
  accent: "bg-accentSoft text-accent",
  gold: "bg-goldSoft text-gold",
  danger: "bg-dangerSoft text-danger",
  warn: "bg-warnSoft text-warn",
  ok: "bg-okSoft text-ok",
  neutral: "bg-surface2 text-ink2 border border-line",
};

export type IconChipProps = {
  name: IconName;
  tone?: ChipTone;
  /** 32 dans les en-têtes de carte, 28 dans les lignes serrées, 34 sur les KPI. */
  size?: 28 | 32 | 34 | 52;
  className?: string;
  title?: string;
};

const CHIP_BOX: Record<number, string> = {
  28: "h-7 w-7 rounded-[9px]",
  32: "h-8 w-8 rounded-[9px]",
  34: "h-[34px] w-[34px] rounded-[10px]",
  52: "h-13 w-13 rounded-[14px]",
};

export function IconChip({
  name,
  tone = "accent",
  size = 32,
  className,
  title,
}: IconChipProps) {
  const glyph = size >= 52 ? 26 : size >= 34 ? 20 : size >= 32 ? 19 : 17;
  return (
    <span
      className={clsx(
        "inline-flex shrink-0 items-center justify-center",
        CHIP_BOX[size],
        CHIP_TONES[tone],
        className,
      )}
    >
      <Icon name={name} size={glyph} title={title} />
    </span>
  );
}
