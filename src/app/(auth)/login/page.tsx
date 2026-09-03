import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { LoginForm } from "./LoginForm";
import { getAuthContext } from "@/lib/authz/guard";

export const metadata = { title: "Connexion — Direct Conseil" };

export default async function LoginPage() {
  const ctx = await getAuthContext();
  if (ctx) redirect(ctx.membership.role === "client" ? "/portal" : "/dashboard");

  return (
    <div className="bg-surface border border-line rounded-xl p-6 shadow-sm">
      <div className="flex justify-center mb-6">
        <span className="brand-plate">
          <Image
            src="/logo.png"
            alt="Direct Conseil — centre d'affaires et comptabilité"
            width={720}
            height={240}
            priority
            className="brand-logo"
          />
        </span>
      </div>

      <h1 className="text-xl font-semibold mb-1">Connexion</h1>
      <p className="text-sm text-muted mb-6">Accédez à votre cabinet.</p>
      <LoginForm />
      <p className="text-sm text-muted mt-6">
        Pas encore de cabinet ?{" "}
        <Link href="/signup" className="text-accent underline underline-offset-2 hover:text-[var(--accent-strong)]">
          Créer un compte
        </Link>
      </p>
    </div>
  );
}
