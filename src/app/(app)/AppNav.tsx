"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

export type NavItem = { href: string; label: string };

/**
 * Une entrée est active sur sa section entière : `/clients/xyz` garde « Clients »
 * en surbrillance. Le tableau de bord est comparé strictement, sinon il resterait
 * actif partout.
 */
function isActive(pathname: string, href: string) {
  if (href === "/dashboard") return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

function linkClass(active: boolean) {
  return [
    "relative flex items-center rounded-md px-3 py-2 text-sm transition-colors",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent",
    active
      ? "bg-accentSoft font-medium text-accent"
      : "text-ink2 hover:bg-surface2 hover:text-ink",
  ].join(" ");
}

/** Repère visuel de la section courante, en plus du fond. */
function ActiveMark() {
  return (
    <span
      aria-hidden="true"
      className="absolute inset-y-1.5 start-0 w-0.5 rounded-full bg-accent"
    />
  );
}

export function SidebarNav({ items }: { items: readonly NavItem[] }) {
  const pathname = usePathname();

  return (
    <nav aria-label="Navigation principale" className="flex-1 p-3 grid gap-0.5 content-start">
      {items.map((item) => {
        const active = isActive(pathname, item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={linkClass(active)}
          >
            {active ? <ActiveMark /> : null}
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

/**
 * Navigation mobile. Sous `md`, la barre latérale est masquée : sans ce tiroir,
 * aucune section n'était atteignable depuis un téléphone.
 */
export function MobileNav({
  items,
  cabinetName,
}: {
  items: readonly NavItem[];
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
        className="md:hidden -ms-1 rounded-md p-2 text-ink2 hover:bg-surface2 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      >
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          aria-hidden="true"
        >
          <path d="M4 7h16M4 12h16M4 17h16" />
        </svg>
      </button>

      {open ? (
        <div className="md:hidden fixed inset-0 z-50 flex">
          <button
            type="button"
            aria-label="Fermer le menu"
            onClick={() => setOpen(false)}
            className="absolute inset-0 bg-[var(--overlay)]"
          />
          <div className="relative flex h-full w-72 max-w-[85%] flex-col border-e border-line bg-surface shadow-2">
            <div className="flex items-start justify-between gap-2 border-b border-line px-5 py-4">
              <div className="min-w-0">
                <div className="font-semibold tracking-tight">Direct Conseil</div>
                <div className="truncate text-xs text-muted">{cabinetName}</div>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Fermer le menu"
                className="-me-1 rounded-md p-1.5 text-muted hover:bg-surface2 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  aria-hidden="true"
                >
                  <path d="M6 6l12 12M18 6L6 18" />
                </svg>
              </button>
            </div>

            <nav
              aria-label="Navigation principale"
              className="flex-1 overflow-y-auto p-3 grid gap-0.5 content-start"
            >
              {items.map((item) => {
                const active = isActive(pathname, item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={linkClass(active)}
                  >
                    {active ? <ActiveMark /> : null}
                    {item.label}
                  </Link>
                );
              })}
            </nav>

            <div className="border-t border-line p-3 text-xs text-muted">
              Données hébergées au Maroc
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
