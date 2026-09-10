import type { Config } from "tailwindcss";

export default {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "var(--bg)",
        surface: "var(--surface)",
        surface2: "var(--surface-2)",
        ink: "var(--ink)",
        ink2: "var(--ink-2)",
        muted: "var(--muted)",
        line: "var(--line)",
        accent: "var(--accent)",
        accentInk: "var(--accent-ink)",
        accentSoft: "var(--accent-soft)",
        danger: "var(--red)",
        dangerSoft: "var(--red-soft)",
        warn: "var(--amber)",
        warnSoft: "var(--amber-soft)",
        ok: "var(--green)",
        okSoft: "var(--green-soft)",
        /* Or de marque : une valeur, jamais un état. */
        gold: "var(--gold)",
        goldInk: "var(--gold-ink)",
        goldSoft: "var(--gold-soft)",
        goldLine: "var(--gold-line)",
        /* Chrome de la barre latérale, et plaque du logo. */
        chrome: "var(--chrome)",
        chromeInk: "var(--chrome-ink)",
        chromeLine: "var(--chrome-line)",
        plate: "var(--plate)",
        plateInk: "var(--plate-ink)",
        /* Liseré supérieur des cartes. */
        edge: "var(--edge)",
      },
      fontFamily: { sans: ["var(--font-sans)"], mono: ["var(--font-mono)"] },
      /* Échelle du produit : les cartes sont à 14, les tuiles à 10-11 capitales. */
      fontSize: {
        "2xs": ["10.5px", { lineHeight: "1.35" }],
        xs: ["11.5px", { lineHeight: "1.4" }],
        sm: ["13px", { lineHeight: "1.45" }],
        base: ["14px", { lineHeight: "1.5" }],
        md: ["15px", { lineHeight: "1.4" }],
        lg: ["17px", { lineHeight: "1.35" }],
        xl: ["20px", { lineHeight: "1.3" }],
        "2xl": ["24px", { lineHeight: "1.25", letterSpacing: "-0.02em" }],
        "3xl": ["28px", { lineHeight: "1.15", letterSpacing: "-0.03em" }],
        "4xl": ["32px", { lineHeight: "1.05", letterSpacing: "-0.03em" }],
      },
      fontWeight: { 550: "550", 650: "650" },
      borderRadius: { card: "14px", control: "10px", chip: "9px" },
      boxShadow: { edge: "inset 0 1px 0 var(--edge)" },
    },
  },
  plugins: [],
} satisfies Config;
