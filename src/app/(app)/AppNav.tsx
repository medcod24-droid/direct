"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { CountBadge, Icon, type IconName } from "@/components/ui";

export type NavItem = {
  href: string;
  label: string;
  icon: IconName;
  /** Nombre d'éléments demandant une action. Zéro n'affiche rien. */
  count?: number;
  /** Vrai quand le compteur signale un retard : la pastille passe au rouge. */
  alert?: boolean;
};

export type NavGroup = { title: string; items: readonly NavItem[] };

/**
 * Une entrée est active sur sa section entière : `/clients/xyz` garde « Clients »
 * en surbrillance. Le tableau de bord est comparé strictement, sinon il resterait
 * actif partout.
 */
function isActive(pathname: string, href: string) {
  if (href === "/dashboard") return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * Ligne de navigation.
 *
 * L'état actif est une pilule pleine, pas un simple changement de couleur : sur
 * une barre latérale sombre et dense, la teinte seule ne se repère pas.
 */
function NavLink({ item, active }: { item: NavItem; active: boolean }) {
  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      className={[
        "flex h-[38px] items-center gap-2.5 rounded-chip px-2.5 text-sm transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent",
        active
          ? "bg-accentSoft font-650 text-accent"
          : "font-medium text-chromeInk hover:bg-surface2 hover:text-ink",
      ].join(" ")}
    >
      <Icon name={item.icon} size={20} />
      <span className="min-w-0 flex-1 truncate">{item.label}</span>
      {item.count ? (
        <CountBadge
          value={item.count}
          tone={item.alert ? "danger" : active ? "accent" : "neutral"}
        />
      ) : null}
    </Link>
  );
}

export function SidebarNav({ groups }: { groups: readonly NavGroup[] }) {
  const pathname = usePathname();

  return (
    <nav aria-label="Navigation principale" className="flex flex-col gap-3.5">
      {groups.map((group) => (
        <div key={group.title} className="flex flex-col gap-0.5">
          <div className="px-2.5 pb-1 pt-1.5 text-[10.5px] font-bold uppercase tracking-[0.12em] text-muted">
            {group.title}
          </div>
          {group.items.map((item) => (
            <NavLink key={item.href} item={item} active={isActive(pathname, item.href)} />
          ))}
        </div>
      ))}
    </nav>
  );
}

/**
 * Navigation mobile. Sous `md`, la barre latérale est masquée : sans ce tiroir,
 * aucune section n'était atteignable depuis un téléphone.
 */
export function MobileNav({
  groups,
  cabinetName,
}: {
  groups: readonly NavGroup[];
  cabinetName: string;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  // Refermer après navigation : le tiroir ne doit pas masquer la page demandée.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // Échap referme, et le fond ne défile pas derrière le tiroir ouvert.
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Ouvrir le menu"
        aria-expanded={open}
        className="-ms-1 rounded-chip p-2 text-ink2 hover:bg-surface2 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent md:hidden"
      >
        <Icon name="dash" size={20} stroke={2} />
      </button>

      {open ? (
        <div className="fixed inset-0 z-50 flex md:hidden">
          <button
            type="button"
            aria-label="Fermer le menu"
            onClick={() => setOpen(false)}
            className="absolute inset-0 bg-[var(--overlay)]"
          />
          <div className="relative flex h-full w-72 max-w-[85%] flex-col border-e border-chromeLine bg-chrome shadow-panel">
            <div className="flex items-center gap-2.5 border-b border-chromeLine p-3">
              <span className="flex h-[30px] w-[30px] items-center justify-center rounded-lg bg-accent text-[12px] font-bold text-white">
                DC
              </span>
              <div className="min-w-0 flex flex-col">
                <span className="text-sm font-650 text-ink">Direct Conseil</span>
                <span className="truncate text-[11px] text-muted">{cabinetName}</span>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Fermer le menu"
                className="ms-auto rounded-chip p-1.5 text-muted hover:bg-surface2 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                <Icon name="x" size={18} stroke={2} />
              </button>
            </div>
            <div className="flex-1 overflow-auto p-2.5">
              <SidebarNav groups={groups} />
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
