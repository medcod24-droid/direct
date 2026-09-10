import { clsx } from "clsx";
import { initials } from "@/lib/format";
import { getDictionary, t, type Locale } from "@/lib/i18n";

export type AvatarSize = "xs" | "sm" | "md";

export type AvatarProps = {
  name: string;
  size?: AvatarSize;
  /** Teinte stable dérivée du nom ; sinon la couleur d'accent. */
  colorful?: boolean;
  className?: string;
  locale?: Locale;
};

const SIZES: Record<AvatarSize, string> = {
  xs: "h-6 w-6 rounded-[7px] text-[10px]",
  sm: "h-7 w-7 rounded-chip text-[11px]",
  md: "h-[34px] w-[34px] rounded-control text-xs",
};

/** Palette dérivée des jetons : aucune couleur sémantique de conformité. */
const HUES = [
  "bg-accentSoft text-accent",
  "bg-surface2 text-ink2",
  "bg-[var(--accent)] text-accentInk",
];

function hueOf(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i += 1) {
    hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  }
  return HUES[hash % HUES.length] ?? "bg-surface2 text-ink2";
}

export function Avatar({ name, size = "sm", colorful = true, className, locale = "fr" }: AvatarProps) {
  const dict = getDictionary(locale);

  return (
    <span
      role="img"
      aria-label={t(dict, "a11y.avatarOf", { name })}
      title={name}
      className={clsx(
        "inline-flex shrink-0 select-none items-center justify-center border border-line font-bold uppercase",
        SIZES[size],
        colorful ? hueOf(name) : "bg-surface2 text-ink2",
        className,
      )}
    >
      <span aria-hidden="true">{initials(name)}</span>
    </span>
  );
}
