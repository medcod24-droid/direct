import { clsx } from "clsx";
import type { ReactNode } from "react";

export type Tone = "neutral" | "accent" | "red" | "amber" | "green";

export type BadgeProps = {
  tone?: Tone;
  /** Pastille de couleur devant le libellé. */
  dot?: boolean;
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
};

const DOTS: Record<Tone, string> = {
  neutral: "bg-muted",
  accent: "bg-accent",
  red: "bg-danger",
  amber: "bg-warn",
  green: "bg-ok",
};

export function Badge({ tone = "neutral", dot = true, className, title, children }: BadgeProps) {
  return (
    <span
      title={title}
      className={clsx(
        "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium leading-5",
        TONES[tone],
        className,
      )}
    >
      {dot ? (
        <span aria-hidden="true" className={clsx("h-1.5 w-1.5 shrink-0 rounded-full", DOTS[tone])} />
      ) : null}
      <span className="truncate">{children}</span>
    </span>
  );
}
