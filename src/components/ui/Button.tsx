import { clsx } from "clsx";
import Link from "next/link";
import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from "react";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type ButtonSize = "sm" | "md";

type CommonProps = {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Icône (SVG inline) placée avant le libellé. */
  icon?: ReactNode;
  fullWidth?: boolean;
  className?: string;
  children?: ReactNode;
};

/** Avec `href`, le composant rend un lien : la navigation reste un vrai lien
 *  (ouvrable dans un onglet, indexable), avec l'apparence d'un bouton. */
export type ButtonProps =
  | (CommonProps &
      Omit<ButtonHTMLAttributes<HTMLButtonElement>, keyof CommonProps | "href"> & {
        href?: undefined;
      })
  | (CommonProps &
      Omit<AnchorHTMLAttributes<HTMLAnchorElement>, keyof CommonProps | "href"> & {
        href: string;
      });

const BASE =
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md border font-medium " +
  "transition-colors duration-150 disabled:pointer-events-none disabled:opacity-45";

const VARIANTS: Record<ButtonVariant, string> = {
  primary:
    "border-transparent bg-accent text-accentInk hover:bg-[var(--accent-strong)]",
  secondary:
    "border-line bg-surface text-ink hover:bg-surface2",
  ghost:
    "border-transparent bg-transparent text-ink2 hover:bg-surface2 hover:text-ink",
  danger:
    "border-transparent bg-danger text-[var(--red-ink)] hover:bg-[var(--red-strong)]",
};

const SIZES: Record<ButtonSize, string> = {
  sm: "h-8 px-2.5 text-[13px]",
  md: "h-9 px-3.5 text-sm",
};

export function Button(props: ButtonProps) {
  const { variant = "secondary", size = "md", icon, fullWidth = false, className, children } = props;
  const classes = clsx(BASE, VARIANTS[variant], SIZES[size], fullWidth && "w-full", className);

  const label = (
    <>
      {icon ? (
        <span aria-hidden="true" className="shrink-0 [&>svg]:h-4 [&>svg]:w-4">
          {icon}
        </span>
      ) : null}
      {children}
    </>
  );

  if (props.href !== undefined) {
    const { href, variant: _v, size: _s, icon: _i, fullWidth: _f, className: _c, children: _ch, ...rest } = props;
    return (
      <Link href={href} className={classes} {...rest}>
        {label}
      </Link>
    );
  }

  const { type = "button", variant: _v, size: _s, icon: _i, fullWidth: _f, className: _c, children: _ch, ...rest } = props;
  return (
    <button type={type} className={classes} {...rest}>
      {label}
    </button>
  );
}
