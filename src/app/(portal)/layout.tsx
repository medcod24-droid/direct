import { redirect } from "next/navigation";
import { getAuthContext } from "@/lib/authz/guard";

/**
 * Garde du portail client.
 *
 * Sans ce layout, une visite non authentifiée sur `/portal` faisait remonter
 * l'erreur de `requirePortal()` jusqu'à une page 500, au lieu de renvoyer vers
 * la connexion comme le fait l'espace cabinet. Un compte du cabinet qui atterrit
 * ici est renvoyé chez lui plutôt que de voir un écran vide.
 */
export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const ctx = await getAuthContext();
  if (!ctx) redirect("/login");
  if (ctx.membership.role !== "client") redirect("/dashboard");

  return <>{children}</>;
}
