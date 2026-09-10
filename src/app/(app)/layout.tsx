import Link from "next/link";
import { redirect } from "next/navigation";
import { logoutAction } from "@/app/actions/auth";
import { getAuthContext } from "@/lib/authz/guard";
import type { Permission } from "@/lib/authz/permissions";
import { ROLE_LABELS } from "@/lib/domain/labels";
import { getNavCounts } from "@/server/services/dashboard";
import { Avatar, CountBadge, Icon, Logo, ThemeToggle } from "@/components/ui";
import { MobileNav, SidebarNav, type NavGroup, type NavItem } from "./AppNav";
import { AppSearch } from "./AppSearch";

type Entry = NavItem & { permission: Permission };
type Group = { title: string; items: readonly Entry[] };

/**
 * Navigation, en trois groupes.
 *
 * Le regroupement n'est pas décoratif : une barre de onze entrées plates ne se
 * parcourt pas. « Suivi » est ce qu'on ouvre le matin, « Travail » ce qu'on
 * exécute, « Cabinet » ce qui concerne la maison elle-même.
 */
function navigation(counts: Awaited<ReturnType<typeof getNavCounts>>): Group[] {
  return [
    {
      title: "Suivi",
      items: [
        { href: "/dashboard", label: "Tableau de bord", icon: "dash", permission: "cabinet.view" },
        {
          href: "/clients",
          label: "Clients",
          icon: "clients",
          count: counts.clients,
          permission: "client.view",
        },
        {
          href: "/deadlines",
          label: "Échéances",
          icon: "calendar",
          count: counts.deadlinesOverdue,
          alert: counts.deadlinesOverdue > 0,
          permission: "deadline.view",
        },
        {
          href: "/appointments",
          label: "Rendez-vous",
          icon: "clock",
          count: counts.appointmentsToday,
          permission: "appointment.view",
        },
      ],
    },
    {
      title: "Travail",
      items: [
        {
          href: "/todos",
          label: "To-do équipe",
          icon: "task",
          count: counts.todos,
          alert: counts.todosToApprove > 0,
          permission: "todo.view",
        },
        {
          href: "/tasks",
          label: "Tâches",
          icon: "check",
          count: counts.tasksOpen,
          permission: "task.view",
        },
        {
          href: "/requests",
          label: "Demandes",
          icon: "inbox",
          count: counts.requestsToReview,
          permission: "request.view",
        },
        {
          href: "/documents",
          label: "Documents",
          icon: "doc",
          count: counts.documentsToReview,
          permission: "document.view",
        },
      ],
    },
    {
      title: "Cabinet",
      items: [
        { href: "/invoices", label: "Honoraires", icon: "coins", permission: "invoice.view" },
        {
          href: "/resultats",
          label: "Résultat",
          icon: "chart",
          count: counts.resultMissing,
          alert: counts.resultMissing > 0,
          permission: "finance.view",
        },
        { href: "/team", label: "Équipe", icon: "team", permission: "member.view" },
      ],
    },
  ];
}

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const ctx = await getAuthContext();
  if (!ctx) redirect("/login");
  // Un compte client n'a rien à faire dans l'espace cabinet.
  if (ctx.membership.role === "client") redirect("/portal");

  const [unread, counts] = await Promise.all([
    ctx.db.notification.count({ where: { userId: ctx.user.id, readAt: null } }),
    getNavCounts(ctx),
  ]);

  const groups: NavGroup[] = navigation(counts)
    .map((group) => ({
      title: group.title,
      items: group.items
        .filter((item) => ctx.can(item.permission))
        .map(({ permission: _p, ...item }) => item),
    }))
    .filter((group) => group.items.length > 0);

  return (
    <div className="flex min-h-screen bg-bg text-ink">
      <aside className="sticky top-0 hidden h-screen w-[248px] shrink-0 flex-col gap-3.5 overflow-auto border-e border-chromeLine bg-chrome p-3 md:flex">
        {/* Le logo est blanc et vert : il ne se lit que sur une plaque sombre,
            y compris en thème clair. */}
        <Link
          href="/dashboard"
          className="flex items-center gap-2.5 rounded-lg bg-plate p-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          <Logo className="w-36" priority />
        </Link>
        <p className="-mt-2 truncate px-1.5 text-[11px] text-muted">{ctx.cabinet.name}</p>

        <SidebarNav groups={groups} />

        <div className="mt-auto flex flex-col gap-0.5 border-t border-chromeLine pt-2.5">
          <Link
            href="/settings"
            className="flex h-[38px] items-center gap-2.5 rounded-chip px-2.5 text-sm text-chromeInk transition-colors hover:bg-surface2 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            <Icon name="settings" size={20} />
            <span>Paramètres</span>
          </Link>
          <Link
            href="/notifications"
            className="flex h-[38px] items-center gap-2.5 rounded-chip px-2.5 text-sm text-chromeInk transition-colors hover:bg-surface2 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            <Icon name="bell" size={20} />
            <span className="flex-1">Notifications</span>
            {unread > 0 ? <CountBadge value={unread} tone="danger" /> : null}
          </Link>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-10 flex h-[60px] shrink-0 items-center gap-3.5 border-b border-line bg-surface px-4 md:px-5">
          <MobileNav groups={groups} cabinetName={ctx.cabinet.name} />
          <Link href="/dashboard" className="rounded bg-plate p-1 md:hidden">
            <Logo className="w-28" />
          </Link>

          <div className="hidden flex-1 sm:flex">
            <AppSearch />
          </div>

          <div className="ms-auto flex shrink-0 items-center gap-2.5">
            <ThemeToggle />
            <Link
              href="/notifications"
              aria-label={`Notifications${unread > 0 ? ` — ${unread} non lues` : ""}`}
              className="relative flex h-[38px] w-[38px] items-center justify-center rounded-control border border-line bg-surface2 text-ink2 transition-colors hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              <Icon name="bell" size={18} />
              {unread > 0 ? (
                <span className="absolute -top-1.5 -end-1.5 flex h-[17px] min-w-[17px] items-center justify-center rounded-full bg-danger px-1 text-[10px] font-bold text-[var(--red-ink)]">
                  {unread}
                </span>
              ) : null}
            </Link>

            <div className="flex items-center gap-2.5 ps-1">
              <Avatar name={ctx.user.name} size="md" />
              <div className="hidden leading-tight lg:block">
                <div className="text-[12.5px] font-semibold text-ink">{ctx.user.name}</div>
                <div className="text-[11px] text-muted">
                  {ROLE_LABELS[ctx.membership.role] ?? ctx.membership.role}
                </div>
              </div>
            </div>

            <form action={logoutAction}>
              <button
                type="submit"
                aria-label="Déconnexion"
                title="Déconnexion"
                className="flex h-[38px] w-[38px] items-center justify-center rounded-control border border-line bg-surface2 text-ink2 transition-colors hover:text-danger focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                <Icon name="login" size={18} />
              </button>
            </form>
          </div>
        </header>

        <main className="mx-auto flex w-full max-w-[1520px] flex-1 flex-col gap-[18px] p-4 pb-10 md:px-5 md:pt-[22px]">
          {children}
        </main>
      </div>
    </div>
  );
}
