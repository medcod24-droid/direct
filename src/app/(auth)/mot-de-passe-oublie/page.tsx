import Link from "next/link";
import { Logo } from "@/components/ui";
import { ForgotForm } from "./ForgotForm";

export const metadata = { title: "Mot de passe oublié — Direct Conseil" };

export default function ForgotPasswordPage() {
  return (
    <div className="bg-surface border border-line rounded-xl p-6 shadow-sm">
      <div className="mb-6 flex justify-center">
        <Logo className="w-56 sm:w-64" priority />
      </div>

      <h1 className="text-xl font-semibold mb-1">Mot de passe oublié</h1>
      <p className="text-sm text-muted mb-6">
        Indiquez l&apos;adresse de votre compte : vous recevrez un lien pour en choisir un nouveau.
      </p>
      <ForgotForm />
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
