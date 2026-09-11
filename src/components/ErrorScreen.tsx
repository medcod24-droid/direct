"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui";
import { ErrorView } from "./ErrorView";

type RouteError = Error & { digest?: string };

/** Code métier porté par le `digest` des erreurs applicatives (voir `AppError`). */
function codeOf(error: RouteError): string | null {
  return error.digest?.startsWith("direct:") ? error.digest.slice("direct:".length) : null;
}

/**
 * Page d'erreur des routes.
 *
 * Next.js ne transmet au navigateur que le `digest` de l'erreur : le message est
 * masqué en production. `AppError` y inscrit son code, ce qui suffit à dire
 * « accès réservé » plutôt que « une erreur est survenue » quand un assistant
 * ouvre une page de l'administration.
 */
export function ErrorScreen({ error, reset }: { error: RouteError; reset: () => void }) {
  const code = codeOf(error);

  useEffect(() => {
    if (!code) console.error(error);
  }, [code, error]);

  if (code === "forbidden") {
    return (
      <ErrorView
        icon="shield"
        tone="warn"
        title="Accès réservé"
        actions={
          <Button href="/dashboard" variant="primary">
            Retour au tableau de bord
          </Button>
        }
      >
        <p>Cette page demande un droit qui ne vous a pas été accordé.</p>
        <p className="text-muted">
          Si vous en avez besoin, demandez-le à l&apos;administration du cabinet : les droits de
          chacun se règlent dans la section Équipe.
        </p>
      </ErrorView>
    );
  }

  if (code === "not_found") {
    return (
      <ErrorView
        icon="search"
        tone="neutral"
        title="Introuvable"
        actions={
          <>
            <Button href="/clients" variant="primary">
              Retour aux dossiers
            </Button>
            <Button href="/dashboard">Tableau de bord</Button>
          </>
        }
      >
        <p>
          Cet élément n&apos;existe pas, a été retiré, ou ne fait pas partie des dossiers qui vous
          sont confiés.
        </p>
      </ErrorView>
    );
  }

  if (code === "unauthenticated") {
    return (
      <ErrorView
        icon="login"
        tone="neutral"
        title="Session expirée"
        actions={
          <Button href="/login" variant="primary">
            Se reconnecter
          </Button>
        }
      >
        <p>Par sécurité, la session se ferme après une période d&apos;inactivité.</p>
      </ErrorView>
    );
  }

  return (
    <ErrorView
      icon="alert"
      tone="danger"
      title="Une erreur est survenue"
      actions={
        <>
          <Button variant="primary" onClick={reset}>
            Réessayer
          </Button>
          <Button href="/dashboard">Tableau de bord</Button>
        </>
      }
    >
      <p>L&apos;incident a été enregistré. Réessayez ; s&apos;il se reproduit, signalez-le.</p>
      {error.digest ? (
        <p className="tabular text-xs text-muted">Référence : {error.digest}</p>
      ) : null}
    </ErrorView>
  );
}
