import Link from "next/link";
import { redirect } from "next/navigation";
import { Alert, Logo } from "@/components/ui";
import { LoginForm } from "./LoginForm";
import { getAuthContext } from "@/lib/authz/guard";

export const metadata = { title: "Connexion — Direct Conseil" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const ctx = await getAuthContext();
  if (ctx) redirect(ctx.membership.role === "client" ? "/portal" : "/dashboard");
  // Posé par la réinitialisation : le mot de passe vient d'être changé.
  const reinitialise = (await searchParams).reinitialise === "1";

  return (
    <div className="bg-surface border border-line rounded-xl p-6 shadow-sm">
      <div className="mb-6 flex justify-center">
        <Logo className="w-56 sm:w-64" priority />
      </div>

      <h1 className="text-xl font-semibold mb-1">Connexion</h1>
      <p className="text-sm text-muted mb-6">Accédez à votre cabinet.</p>

      {reinitialise ? (
        <Alert tone="success" title="Mot de passe enregistré" className="mb-4">
          Connectez-vous avec votre nouveau mot de passe.
        </Alert>
      ) : null}

      <LoginForm />

      <p className="text-sm text-muted mt-4">
        <Link
          href="/mot-de-passe-oublie"
          className="text-accent underline underline-offset-2 hover:text-[var(--accent-strong)]"
        >
          Mot de passe oublié ?
        </Link>
      </p>

      <p className="text-sm text-muted mt-6">
        Pas encore de cabinet ?{" "}
        <Link href="/signup" className="text-accent underline underline-offset-2 hover:text-[var(--accent-strong)]">
          Créer un compte
        </Link>
      </p>
    </div>
  );
}
