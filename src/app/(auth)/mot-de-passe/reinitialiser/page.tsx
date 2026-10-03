import Link from "next/link";
import { Alert, Logo } from "@/components/ui";
import { ResetForm } from "./ResetForm";

export const metadata = { title: "Nouveau mot de passe — Direct Conseil" };

/**
 * Choix d'un nouveau mot de passe, depuis le lien reçu par courriel.
 *
 * Le jeton vient de l'adresse et n'est pas vérifié ici : le faire afficherait
 * « lien valide » ou « lien expiré » avant toute saisie, ce qui permettrait de
 * tester des jetons à la chaîne. Il est contrôlé à l'enregistrement.
 */
export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const jeton = (await searchParams).jeton;
  const token = typeof jeton === "string" ? jeton : "";

  return (
    <div className="bg-surface border border-line rounded-xl p-6 shadow-sm">
      <div className="mb-6 flex justify-center">
        <Logo className="w-56 sm:w-64" priority />
      </div>

      <h1 className="text-xl font-semibold mb-1">Nouveau mot de passe</h1>
      <p className="text-sm text-muted mb-6">
        Au moins 12 caractères, avec une majuscule, une minuscule et un chiffre.
      </p>

      {token ? (
        <ResetForm token={token} />
      ) : (
        <Alert tone="warning" title="Lien incomplet">
          Ce lien ne contient pas de jeton. Ouvrez-le depuis le courriel reçu, ou{" "}
          <Link href="/mot-de-passe-oublie" className="underline underline-offset-2">
            demandez-en un nouveau
          </Link>
          .
        </Alert>
      )}

      <p className="text-sm text-muted mt-6">
        <Link
          href="/login"
          className="text-accent underline underline-offset-2 hover:text-[var(--accent-strong)]"
        >
          Retour à la connexion
        </Link>
      </p>
    </div>
  );
}
