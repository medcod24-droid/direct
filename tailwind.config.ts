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
      },
      fontFamily: { sans: ["var(--font-sans)"], mono: ["var(--font-mono)"] },
    },
  },
  plugins: [],
} satisfies Config;
