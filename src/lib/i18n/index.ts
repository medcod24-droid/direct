import { fr } from "./fr";
import { ar } from "./ar";
import { en } from "./en";

export const LOCALES = ["fr", "ar", "en"] as const;
export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "fr";

/** Même arborescence que `fr`, mais les feuilles sont de simples `string`. */
type Shape<T> = { [K in keyof T]: T[K] extends string ? string : Shape<T[K]> };

export type Dictionary = Shape<typeof fr>;

/** Toutes les clés valides sous forme « a.b.c », vérifiées à la compilation. */
export type TranslationKey = Leaves<Dictionary>;

type Leaves<T> = {
  [K in keyof T & string]: T[K] extends string ? K : `${K}.${Leaves<T[K]>}`;
}[keyof T & string];

export type TranslationVars = Record<string, string | number>;

const DICTIONARIES: Record<Locale, Dictionary> = { fr, ar, en };

export function isLocale(value: string): value is Locale {
  return (LOCALES as readonly string[]).includes(value);
}

export function getDictionary(locale: Locale = DEFAULT_LOCALE): Dictionary {
  return DICTIONARIES[locale];
}

export function isRtl(locale: Locale): boolean {
  return locale === "ar";
}

/** Attribut `dir` à poser sur `<html>`. */
export function dirOf(locale: Locale): "ltr" | "rtl" {
  return isRtl(locale) ? "rtl" : "ltr";
}

/**
 * Lit une clé « a.b.c » et interpole les variables `{nom}`.
 * En cas de clé absente à l'exécution, retourne la clé : jamais d'exception
 * dans un rendu, et l'anomalie reste visible.
 */
export function t(dict: Dictionary, key: TranslationKey, vars?: TranslationVars): string {
  const value = resolve(dict, key);
  if (value === undefined) return key;
  return vars ? interpolate(value, vars) : value;
}

function resolve(dict: Dictionary, key: string): string | undefined {
  let node: unknown = dict;
  for (const segment of key.split(".")) {
    if (typeof node !== "object" || node === null) return undefined;
    node = (node as Record<string, unknown>)[segment];
  }
  return typeof node === "string" ? node : undefined;
}

function interpolate(template: string, vars: TranslationVars): string {
  return template.replace(/\{(\w+)\}/g, (match, name: string) => {
    const value = vars[name];
    return value === undefined ? match : String(value);
  });
}

export { fr, ar, en };
