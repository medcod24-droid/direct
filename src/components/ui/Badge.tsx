import { clsx } from "clsx";
import type { ReactNode } from "react";
import { Icon, type IconName } from "./Icon";

export type Tone = "neutral" | "accent" | "red" | "amber" | "green" | "gold";

export type BadgeProps = {
  tone?: Tone;
  /** Pastille de couleur devant le libellé. */
  dot?: boolean;
  /**
   * Icône du jeu à la place de la pastille.
   *
   * Un état ne doit jamais tenir à la seule couleur : sur les statuts de
   * conformité, l'icône est ce qui reste lisible en noir et blanc, à
   * l'impression comme pour un daltonien.
   */
  iconName?: IconName;
  className?: string;
  title?: string;
  children: ReactNode;
};

const TONES: Record<Tone, string> = {
  neutral: "border-line bg-surface2 text-ink2",
  accent: "border-transparent bg-accentSoft text-accent",
  red: "border-transparent bg-dangerSoft text-danger",
  amber: "border-transparent bg-warnSoft text-warn",
  green: "border-transparent bg-okSoft text-ok",
  gold: "border-goldLine bg-goldSoft text-gold",
};

const DOTS: Record<Tone, string> = {
  neutral: "bg-muted",
  accent: "bg-accent",
  red: "bg-danger",
  amber: "bg-warn",
  green: "bg-ok",
  gold: "bg-gold",
};

export function Badge({ tone = "neutral", dot = true, iconName, className, title, children }: BadgeProps) {
  return (
    <span
      title={title}
      className={clsx(
        "inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-0.5 text-xs font-bold leading-5",
        TONES[tone],
        className,
      )}
    >
      {iconName ? (
        <Icon name={iconName} size={13} stroke={2} />
      ) : dot ? (
        <span aria-hidden="true" className={clsx("h-1.5 w-1.5 shrink-0 rounded-full", DOTS[tone])} />
      ) : null}
      <span className="truncate">{children}</span>
    </span>
  );
}
