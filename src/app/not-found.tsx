import { Button } from "@/components/ui";
import { ErrorView } from "@/components/ErrorView";

export const metadata = { title: "Page introuvable — Direct Conseil" };

/** Page introuvable hors du cadre de l'application — le 404 par défaut est en anglais. */
export default function NotFound() {
  return (
    <ErrorView
      icon="search"
      tone="neutral"
      title="Page introuvable"
      actions={
        <Button href="/" variant="primary">
          Accueil
        </Button>
      }
    >
      <p>Cette adresse ne correspond à aucune page de Direct Conseil.</p>
    </ErrorView>
  );
}
