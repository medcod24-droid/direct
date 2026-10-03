import Link from "next/link";
import { Alert, Logo } from "@/components/ui";
import { mailStatus } from "@/lib/mail/send";
import { ForgotForm } from "./ForgotForm";

export const metadata = { title: "Mot de passe oublié — Direct Conseil" };

/**
 * Un envoi non configuré ne doit pas se déguiser en courriel parti.
 *
 * Le message neutre (« si un compte existe, le lien part ») protège l'existence
 * des comptes ; il devient un mensonge quand aucun transport n'est branché. Le
 * défaut d'installation, lui, n'a rien de confidentiel : on l'affiche.
 */
export default function ForgotPasswordPage() {
  const envoiPossible = mailStatus() === "ok";

  return (
    <div className="bg-surface border border-line rounded-xl p-6 shadow-sm">
      <div className="mb-6 flex justify-center">
        <Logo className="w-56 sm:w-64" priority />
      </div>

      <h1 className="text-xl font-semibold mb-1">Mot de passe oublié</h1>
      <p className="text-sm text-muted mb-6">
        Indiquez l&apos;adresse de votre compte : vous recevrez un lien pour en choisir un nouveau.
      </p>
      {envoiPossible ? (
        <ForgotForm />
      ) : (
        <Alert tone="warning" title="L'envoi de courriels n'est pas encore activé">
          Le lien ne peut pas vous parvenir tant qu&apos;un service d&apos;envoi n&apos;est pas
          branché sur la plateforme. En attendant, demandez votre mot de passe à
          l&apos;administration de votre cabinet.
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
