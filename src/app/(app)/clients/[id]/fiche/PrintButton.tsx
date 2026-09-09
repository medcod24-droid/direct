"use client";

import { Button } from "@/components/ui";

/**
 * Déclenche l'impression du navigateur.
 *
 * Pas de moteur PDF côté serveur : la boîte d'impression donne déjà
 * « Enregistrer au format PDF », et l'usage visé est d'imprimer pour classer.
 * Une dépendance de rendu PDF aurait ajouté un binaire lourd pour le même
 * résultat.
 */
export function PrintButton() {
  return (
    <Button variant="primary" size="sm" onClick={() => window.print()}>
      Imprimer
    </Button>
  );
}
