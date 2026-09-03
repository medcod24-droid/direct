import Link from "next/link";
import { redirect } from "next/navigation";
import { logoutAction } from "@/app/actions/auth";
import { getAuthContext } from "@/lib/authz/guard";
import { Avatar, Badge } from "@/components/ui";
import { MobileNav, SidebarNav } from "./AppNav";

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
        <SidebarNav items={items} />
        <div className="p-3 border-t border-line text-xs text-muted">
          Données hébergées au Maroc
        </div>
      </aside>

      <div className="flex-1 min-w-0 flex flex-col">
        <header className="h-14 border-b border-line bg-surface flex items-center gap-3 px-4 md:px-6">
          <MobileNav items={items} cabinetName={ctx.cabinet.name} />
          <Link href="/dashboard" className="md:hidden font-semibold whitespace-nowrap">
            Direct Conseil
          </Link>
          <div className="flex-1" />
          <Link
            href="/notifications"
            aria-label="Notifications"
            className="flex shrink-0 items-center gap-2 rounded-md px-1.5 py-1 text-sm text-ink2 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
              className="sm:hidden"
            >
              <path d="M18 8A6 6 0 1 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
              <path d="M13.7 21a2 2 0 0 1-3.4 0" />
            </svg>
            <span className="hidden sm:inline">Notifications</span>
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
              aria-label="Déconnexion"
              className="flex shrink-0 items-center rounded px-2 py-1 text-sm text-muted hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
                className="sm:hidden"
              >
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <path d="M16 17l5-5-5-5M21 12H9" />
              </svg>
              <span className="hidden sm:inline">Déconnexion</span>
            </button>
          </form>
        </header>

        <main className="flex-1 w-full max-w-[1400px] mx-auto p-4 md:p-6">{children}</main>
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
