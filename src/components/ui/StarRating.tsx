import { clsx } from "clsx";

export type StarRatingProps = {
  /** 1 à 5, ou `null` quand le dossier n'a pas assez d'historique. */
  stars: number | null;
  /** Explications affichées au survol. */
  reasons?: string[];
  size?: "sm" | "md";
  /** Masque la mention « Non évalué » et ne rend rien si `stars` est nul. */
  hideWhenUnrated?: boolean;
  className?: string;
};

const SIZES = { sm: 12, md: 16 } as const;

/**
 * Note du dossier, de 1 à 5 étoiles.
 *
 * Les étoiles utilisent l'accent, jamais l'ambre : `globals.css` réserve le rouge,
 * l'ambre et le vert aux statuts de conformité. Une étoile dorée se lirait comme
 * un avertissement d'échéance.
 *
 * La note est aussi donnée en toutes lettres pour les lecteurs d'écran : cinq
 * pictogrammes ne disent rien sans texte.
 */
export function StarRating({
  stars,
  reasons,
  size = "md",
  hideWhenUnrated = false,
  className,
}: StarRatingProps) {
  if (stars === null) {
    if (hideWhenUnrated) return null;
    return (
      <span className={clsx("text-xs text-muted", className)} title="Pas assez de factures réglées pour noter ce dossier.">
        Non évalué
      </span>
    );
  }

  const px = SIZES[size];
  const label = `${stars} étoile${stars > 1 ? "s" : ""} sur 5`;

  return (
    <span
      className={clsx("inline-flex items-center gap-0.5", className)}
      role="img"
      aria-label={label}
      title={reasons?.length ? `${label} — ${reasons.join(" ")}` : label}
    >
      {[1, 2, 3, 4, 5].map((position) => {
        const filled = position <= stars;
        return (
          <svg
            key={position}
            width={px}
            height={px}
            viewBox="0 0 24 24"
            aria-hidden="true"
            className={clsx("shrink-0", filled ? "text-accent" : "text-line")}
            fill={filled ? "currentColor" : "none"}
            stroke="currentColor"
            strokeWidth={filled ? 0 : 1.6}
            strokeLinejoin="round"
          >
            <path d="M12 2.6l2.9 5.9 6.5.9-4.7 4.6 1.1 6.5-5.8-3-5.8 3 1.1-6.5L2.6 9.4l6.5-.9z" />
          </svg>
        );
      })}
    </span>
  );
}
