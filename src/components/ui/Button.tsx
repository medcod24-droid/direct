import { clsx } from "clsx";
import Link from "next/link";
import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from "react";
import { Icon, type IconName } from "./Icon";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "gold";
export type ButtonSize = "sm" | "md";

type CommonProps = {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Icône du jeu du produit, placée avant le libellé. */
  iconName?: IconName;
  /** Icône libre, si le jeu ne couvre pas le cas. */
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
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-control border " +
  "transition-[background-color,color,border-color,filter] duration-150 " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 " +
  "focus-visible:ring-offset-[var(--bg)] disabled:pointer-events-none disabled:opacity-45";

const VARIANTS: Record<ButtonVariant, string> = {
  primary: "border-accent bg-accent text-accentInk font-650 hover:brightness-110",
  secondary: "border-line bg-surface text-ink font-semibold hover:bg-surface2",
  ghost: "border-transparent bg-transparent text-ink2 font-medium hover:bg-surface2 hover:text-ink",
  danger: "border-danger bg-danger text-[var(--red-ink)] font-650 hover:brightness-110",
  /* Or : réservé à une action de valeur — imprimer une fiche, exporter un état. */
  gold: "border-goldLine bg-goldSoft text-gold font-650 hover:bg-gold hover:text-goldInk",
};

const SIZES: Record<ButtonSize, string> = {
  sm: "h-8 px-2.5 text-sm",
  md: "h-[38px] px-3.5 text-sm",
};

export function Button(props: ButtonProps) {
  const {
    variant = "secondary",
    size = "md",
    icon,
    iconName,
    fullWidth = false,
    className,
    children,
  } = props;
  const classes = clsx(BASE, VARIANTS[variant], SIZES[size], fullWidth && "w-full", className);

  const label = (
    <>
      {iconName ? <Icon name={iconName} size={size === "sm" ? 16 : 18} /> : null}
      {icon ? (
        <span aria-hidden="true" className="shrink-0 [&>svg]:h-4 [&>svg]:w-4">
          {icon}
        </span>
      ) : null}
      {children}
    </>
  );

  if (props.href !== undefined) {
    const { href, variant: _v, size: _s, icon: _i, iconName: _in, fullWidth: _f, className: _c, children: _ch, ...rest } = props;
    return (
      <Link href={href} className={classes} {...rest}>
        {label}
      </Link>
    );
  }

  const { type = "button", variant: _v, size: _s, icon: _i, iconName: _in, fullWidth: _f, className: _c, children: _ch, ...rest } = props;
  return (
    <button type={type} className={classes} {...rest}>
      {label}
    </button>
  );
}
