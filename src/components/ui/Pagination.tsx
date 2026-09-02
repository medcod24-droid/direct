import { clsx } from "clsx";
import Link from "next/link";
import { getDictionary, t, type Locale } from "@/lib/i18n";

export type PaginationProps = {
  /** Page courante, à partir de 1. */
  page: number;
  pageCount: number;
  /** Construit l'URL d'une page — la pagination reste rendue côté serveur. */
  buildHref: (page: number) => string;
  /** Nombre de pages affichées de chaque côté de la page courante. */
  siblings?: number;
  locale?: Locale;
  className?: string;
};

const ITEM =
  "inline-flex h-8 min-w-[2rem] items-center justify-center rounded-md border px-2 text-[13px] font-medium transition-colors";

export function Pagination({
  page,
  pageCount,
  buildHref,
  siblings = 1,
  locale = "fr",
  className,
}: PaginationProps) {
  const dict = getDictionary(locale);
  if (pageCount <= 1) return null;

  const current = Math.min(Math.max(1, Math.trunc(page)), pageCount);
  const items = pageItems(current, pageCount, siblings);

  return (
    <nav
      aria-label={t(dict, "pagination.label")}
      className={clsx("flex flex-wrap items-center justify-between gap-3", className)}
    >
      <p className="text-xs text-muted tabular">
        {t(dict, "pagination.page", { page: current, pageCount })}
      </p>

      <ul className="flex items-center gap-1">
        <li>
          <Step
            href={current > 1 ? buildHref(current - 1) : undefined}
            label={t(dict, "pagination.previous")}
            direction="previous"
          />
        </li>

        {items.map((item, index) =>
          item === "gap" ? (
            <li key={`gap-${index}`} aria-hidden="true" className="px-1 text-muted">
              …
            </li>
          ) : (
            <li key={item}>
              <Link
                href={buildHref(item)}
                aria-current={item === current ? "page" : undefined}
                aria-label={t(dict, "pagination.goToPage", { page: item })}
                className={clsx(
                  ITEM,
                  "tabular",
                  item === current
                    ? "border-transparent bg-accent text-accentInk"
                    : "border-line bg-surface text-ink2 hover:bg-surface2 hover:text-ink",
                )}
              >
                {item}
              </Link>
            </li>
          ),
        )}

        <li>
          <Step
            href={current < pageCount ? buildHref(current + 1) : undefined}
            label={t(dict, "pagination.next")}
            direction="next"
          />
        </li>
      </ul>
    </nav>
  );
}

function Step({
  href,
  label,
  direction,
}: {
  href: string | undefined;
  label: string;
  direction: "previous" | "next";
}) {
  const chevron = (
    <svg
      aria-hidden="true"
      className="flip-rtl"
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={direction === "previous" ? "m15 18-6-6 6-6" : "m9 18 6-6-6-6"} />
    </svg>
  );

  if (!href) {
    return (
      <span aria-disabled="true" className={clsx(ITEM, "border-line bg-surface2 text-muted opacity-60")}>
        <span className="sr-only">{label}</span>
        {chevron}
      </span>
    );
  }

  return (
    <Link
      href={href}
      rel={direction === "previous" ? "prev" : "next"}
      className={clsx(ITEM, "border-line bg-surface text-ink2 hover:bg-surface2 hover:text-ink")}
    >
      <span className="sr-only">{label}</span>
      {chevron}
    </Link>
  );
}

/** Fenêtre de pages avec ellipses : 1 … 4 5 6 … 20. */
function pageItems(current: number, pageCount: number, siblings: number): Array<number | "gap"> {
  const pages = new Set<number>([1, pageCount]);
  for (let p = current - siblings; p <= current + siblings; p += 1) {
    if (p >= 1 && p <= pageCount) pages.add(p);
  }

  const sorted = [...pages].sort((a, b) => a - b);
  const items: Array<number | "gap"> = [];
  let previous = 0;

  for (const p of sorted) {
    if (previous && p - previous > 1) items.push("gap");
    items.push(p);
    previous = p;
  }

  return items;
}
