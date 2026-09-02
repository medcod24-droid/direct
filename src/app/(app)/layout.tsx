import Link from "next/link";
import { redirect } from "next/navigation";
import { logoutAction } from "@/app/actions/auth";
import { getAuthContext } from "@/lib/authz/guard";
import { Avatar, Badge } from "@/components/ui";

const NAV = [
  { href: "/dashboard", label: "Tableau de bord", permission: "cabinet.view" },
  { href: "/clients", label: "Clients", permission: "client.view" },
  { href: "/deadlines", label: "Échéances", permission: "deadline.view" },
  { href: "/requests", label: "Demandes", permission: "request.view" },
  { href: "/documents", label: "Documents", permission: "document.view" },
  { href: "/tasks", label: "Tâches", permission: "task.view" },
  { href: "/invoices", label: "Honoraires", permission: "invoice.view" },
  { href: "/team", label: "Équipe", permission: "member.view" },
  { href: "/settings", label: "Paramètres", permission: "cabinet.view" },
] as const;

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const ctx = await getAuthContext();
  if (!ctx) redirect("/login");
  // Un compte client n'a rien à faire dans l'espace cabinet.
  if (ctx.membership.role === "client") redirect("/portal");

  const unread = await ctx.db.notification.count({
    where: { userId: ctx.user.id, readAt: null },
  });

  const items = NAV.filter((item) => ctx.can(item.permission));

  return (
    <div className="min-h-screen bg-bg text-ink flex">
      <aside className="w-60 shrink-0 border-e border-line bg-surface hidden md:flex md:flex-col">
        <div className="px-5 py-4 border-b border-line">
          <div className="font-semibold tracking-tight">Direct Conseil</div>
          <div className="text-xs text-muted truncate">{ctx.cabinet.name}</div>
        </div>
        <nav className="flex-1 p-3 grid gap-0.5 content-start">
          {items.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="px-3 py-2 rounded-md text-sm text-ink2 hover:bg-surface2 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="p-3 border-t border-line text-xs text-muted">
          Données hébergées au Maroc
        </div>
      </aside>

      <div className="flex-1 min-w-0 flex flex-col">
        <header className="h-14 border-b border-line bg-surface flex items-center gap-3 px-4 md:px-6">
          <Link href="/dashboard" className="md:hidden font-semibold">
            Direct Conseil
          </Link>
          <div className="flex-1" />
          <Link
            href="/notifications"
            className="text-sm text-ink2 hover:text-ink flex items-center gap-2"
          >
            Notifications
            {unread > 0 ? <Badge tone="accent">{unread}</Badge> : null}
          </Link>
          <div className="flex items-center gap-2">
            <Avatar name={ctx.user.name} />
            <div className="hidden sm:block leading-tight">
              <div className="text-sm">{ctx.user.name}</div>
              <div className="text-xs text-muted">{roleLabel(ctx.membership.role)}</div>
            </div>
          </div>
          <form action={logoutAction}>
            <button
              type="submit"
              className="text-sm text-muted hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded px-2 py-1"
            >
              Déconnexion
            </button>
          </form>
        </header>

        <main className="flex-1 p-4 md:p-6 max-w-[1400px] w-full">{children}</main>
      </div>
    </div>
  );
}

function roleLabel(role: string): string {
  const labels: Record<string, string> = {
    owner: "Gérant",
    admin: "Administrateur",
    accountant: "Comptable",
    assistant: "Assistant",
    client: "Client",
  };
  return labels[role] ?? role;
}
