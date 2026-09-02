import { clsx } from "clsx";
import type { ReactNode } from "react";
import { getDictionary, t, type Locale, type TranslationKey } from "@/lib/i18n";

export type AlertTone = "info" | "warning" | "danger" | "success";

export type AlertProps = {
  tone?: AlertTone;
  title?: ReactNode;
  /** Zone d'action (bouton « Réessayer », lien…). */
  action?: ReactNode;
  className?: string;
  locale?: Locale;
  children?: ReactNode;
};

const STYLES: Record<AlertTone, string> = {
  info: "border-line bg-surface2 text-ink",
  warning: "border-[var(--amber)] bg-warnSoft text-ink",
  danger: "border-[var(--red)] bg-dangerSoft text-ink",
  success: "border-[var(--green)] bg-okSoft text-ink",
};

const ICON_COLOR: Record<AlertTone, string> = {
  info: "text-accent",
  warning: "text-warn",
  danger: "text-danger",
  success: "text-ok",
};

const FALLBACK_TITLE: Record<AlertTone, TranslationKey> = {
  info: "alert.info",
  warning: "alert.warning",
  danger: "alert.danger",
  success: "alert.success",
};

export function Alert({ tone = "info", title, action, className, locale = "fr", children }: AlertProps) {
  const dict = getDictionary(locale);
  const heading = title ?? t(dict, FALLBACK_TITLE[tone]);
  const urgent = tone === "danger" || tone === "warning";

  return (
    <div
      role={urgent ? "alert" : "status"}
      className={clsx("flex items-start gap-3 rounded-lg border p-3", STYLES[tone], className)}
    >
      <span aria-hidden="true" className={clsx("mt-0.5 shrink-0", ICON_COLOR[tone])}>
        <AlertIcon tone={tone} />
      </span>

      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold">{heading}</p>
        {children ? <div className="mt-0.5 text-sm text-ink2">{children}</div> : null}
      </div>

      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

function AlertIcon({ tone }: { tone: AlertTone }) {
  const common = {
    width: 18,
    height: 18,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };

  if (tone === "success") {
    return (
      <svg {...common}>
        <circle cx="12" cy="12" r="9" />
        <path d="m8.5 12.5 2.5 2.5 4.5-5" />
      </svg>
    );
  }
  if (tone === "warning") {
    return (
      <svg {...common}>
        <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
        <path d="M12 9v4" />
        <path d="M12 17h.01" />
      </svg>
    );
  }
  if (tone === "danger") {
    return (
      <svg {...common}>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v6" />
        <path d="M12 16h.01" />
      </svg>
    );
  }
  return (
    <svg {...common}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5" />
      <path d="M12 8h.01" />
    </svg>
  );
}
