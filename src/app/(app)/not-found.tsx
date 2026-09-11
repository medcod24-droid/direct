import { Button } from "@/components/ui";
import { ErrorView } from "@/components/ErrorView";

/** Page introuvable, dans le cadre de l'application — le 404 par défaut est en anglais. */
export default function AppNotFound() {
  return (
    <ErrorView
      icon="search"
      tone="neutral"
      title="Page introuvable"
      actions={
        <>
          <Button href="/dashboard" variant="primary">
            Tableau de bord
          </Button>
          <Button href="/clients">Dossiers</Button>
        </>
      }
    >
      <p>Cette adresse ne correspond à aucune page, ou l&apos;élément a été retiré.</p>
    </ErrorView>
  );
}
