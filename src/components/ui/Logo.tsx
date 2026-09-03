import { clsx } from "clsx";
import Image from "next/image";

export type LogoProps = {
  /** Largeur rendue, en classes utilitaires (ex. `w-56`). */
  className?: string;
  /** Chargement prioritaire : à réserver au logo visible au premier écran. */
  priority?: boolean;
};

const ALT = "Direct Conseil — centre d'affaires et comptabilité";

/**
 * Logo adapté au thème.
 *
 * Les deux variantes sont rendues et l'une est masquée en CSS, selon le même
 * découpage que les jetons de couleur (`globals.css`) : préférence système,
 * choix explicite « clair », choix explicite « sombre ». Un choix en JavaScript
 * ferait clignoter la mauvaise variante au premier rendu.
 */
export function Logo({ className, priority = false }: LogoProps) {
  const common = {
    alt: ALT,
    width: 720,
    height: 240,
    priority,
    // Sans `sizes`, Next demande la plus grande variante (1920 px) pour une image
    // affichée à ~224 px : inutile à générer comme à transférer.
    sizes: "256px",
    className: clsx("h-auto w-full", className && "w-full"),
  };

  return (
    <span className={clsx("inline-block", className)}>
      <Image {...common} src="/logo-clair.png" className="logo-clair h-auto w-full" />
      <Image {...common} src="/logo-sombre.png" className="logo-sombre h-auto w-full" alt="" aria-hidden="true" />
    </span>
  );
}
