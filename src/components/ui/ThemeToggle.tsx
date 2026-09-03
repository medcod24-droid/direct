"use client";

import { useEffect, useState } from "react";

export type ThemeChoice = "system" | "light" | "dark";

/** Clé de stockage, partagée avec le script d'amorçage de `layout.tsx`. */
export const THEME_KEY = "dc-theme";

const ORDER: ThemeChoice[] = ["system", "light", "dark"];

const LABELS: Record<ThemeChoice, string> = {
  system: "Thème : système",
  light: "Thème : clair",
  dark: "Thème : sombre",
};

function apply(choice: ThemeChoice) {
  const root = document.documentElement;
  // Aucun attribut = on suit la préférence du système, comme le prévoit globals.css.
  if (choice === "system") delete root.dataset.theme;
  else root.dataset.theme = choice;
  try {
    if (choice === "system") localStorage.removeItem(THEME_KEY);
    else localStorage.setItem(THEME_KEY, choice);
  } catch {
    // Navigation privée ou stockage refusé : le choix vaut pour la session.
  }
}

function readStored(): ThemeChoice {
  try {
    const value = localStorage.getItem(THEME_KEY);
    if (value === "light" || value === "dark") return value;
  } catch {
    // Stockage inaccessible : on retombe sur le système.
  }
  return "system";
}

export function ThemeToggle({ className }: { className?: string }) {
  // Le serveur ignore le choix stocké : on ne rend l'icône qu'après montage,
  // sinon le HTML rendu et celui du navigateur divergent.
  const [choice, setChoice] = useState<ThemeChoice | null>(null);

  useEffect(() => {
    setChoice(readStored());
  }, []);

  function next() {
    const current = choice ?? "system";
    const value = ORDER[(ORDER.indexOf(current) + 1) % ORDER.length]!;
    apply(value);
    setChoice(value);
  }

  const label = choice ? LABELS[choice] : "Changer de thème";

  return (
    <button
      type="button"
      onClick={next}
      aria-label={`${label} — cliquer pour changer`}
      title={label}
      className={[
        "flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-ink2",
        "hover:bg-surface2 hover:text-ink",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent",
        className ?? "",
      ].join(" ")}
    >
      <Icon choice={choice} />
    </button>
  );
}

function Icon({ choice }: { choice: ThemeChoice | null }) {
  const common = {
    width: 18,
    height: 18,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };

  if (choice === "light") {
    return (
      <svg {...common}>
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
      </svg>
    );
  }
  if (choice === "dark") {
    return (
      <svg {...common}>
        <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
      </svg>
    );
  }
  // « Système », et état avant montage : même glyphe, donc aucun saut visuel.
  return (
    <svg {...common}>
      <rect x="2" y="4" width="20" height="13" rx="2" />
      <path d="M8 21h8M12 17v4" />
    </svg>
  );
}
