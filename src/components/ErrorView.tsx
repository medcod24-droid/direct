import type { ReactNode } from "react";
import { IconChip, type ChipTone, type IconName } from "@/components/ui";

/**
 * Écran d'arrêt : accès refusé, élément introuvable, incident.
 *
 * Un collaborateur qui tombe sur une page qui ne lui est pas ouverte doit
 * comprendre pourquoi et savoir quoi faire — jamais lire une trace technique ni
 * un message en anglais.
 */
export function ErrorView({
  icon,
  tone,
  title,
  children,
  actions,
}: {
  icon: IconName;
  tone: ChipTone;
  title: string;
  children: ReactNode;
  actions: ReactNode;
}) {
  return (
    <div className="grid min-h-[60vh] place-items-center p-6">
      <div className="grid max-w-md justify-items-center gap-3 text-center">
        <IconChip name={icon} tone={tone} size={52} />
        <h1 className="text-xl font-650 text-ink">{title}</h1>
        <div className="grid gap-2 text-sm text-ink2">{children}</div>
        <div className="mt-2 flex flex-wrap justify-center gap-2">{actions}</div>
      </div>
    </div>
  );
}
