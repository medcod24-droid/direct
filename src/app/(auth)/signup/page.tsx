import Link from "next/link";
import { redirect } from "next/navigation";
import { SignupForm } from "./SignupForm";
import { getAuthContext } from "@/lib/authz/guard";

export const metadata = { title: "Créer un cabinet — Direct Conseil" };

export default async function SignupPage() {
  const ctx = await getAuthContext();
  if (ctx) redirect("/dashboard");

  return (
    <div className="bg-surface border border-line rounded-xl p-6 shadow-sm">
      <h1 className="text-xl font-semibold mb-1">Créer votre cabinet</h1>
      <p className="text-sm text-muted mb-6">
        30 jours d&apos;essai. Aucune carte bancaire demandée.
      </p>
      <SignupForm />
      <p className="text-sm text-muted mt-6">
        Vous avez déjà un compte ?{" "}
        <Link href="/login" className="text-accent underline underline-offset-2 hover:text-[var(--accent-strong)]">
          Se connecter
        </Link>
      </p>
    </div>
  );
}
