import Link from "next/link";
import { readInvitation } from "@/server/services/members";
import { Alert, Logo } from "@/components/ui";
import { AcceptForm } from "./AcceptForm";

export const metadata = { title: "Rejoindre un cabinet — Direct Conseil" };
export const dynamic = "force-dynamic";

export default async function InvitationPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const invitation = await readInvitation(token);

  return (
    <div className="rounded-xl border border-line bg-surface p-6 shadow-sm">
      <div className="mb-6 flex justify-center">
        <Logo className="w-56" priority />
      </div>

      {invitation === null ? (
        <>
          <h1 className="mb-1 text-xl font-semibold">Invitation invalide</h1>
          <Alert tone="warning">
            Ce lien a déjà été utilisé, a expiré, ou n&apos;existe pas. Demandez une nouvelle
            invitation à votre cabinet.
          </Alert>
          <p className="mt-6 text-sm text-muted">
            <Link href="/login" className="text-accent underline underline-offset-2">
              Retour à la connexion
            </Link>
          </p>
        </>
      ) : (
        <>
          <h1 className="mb-1 text-xl font-semibold">Rejoindre {invitation.cabinet.name}</h1>
          <p className="mb-6 text-sm text-muted">
            Invitation envoyée à <strong>{invitation.email}</strong>. Choisissez votre mot de
            passe pour activer votre accès.
          </p>
          <AcceptForm token={token} />
        </>
      )}
    </div>
  );
}
