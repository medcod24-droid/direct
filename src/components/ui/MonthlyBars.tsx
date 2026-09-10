import { clsx } from "clsx";
import { formatMad } from "@/lib/format";

export type MonthlyBar = {
  label: string;
  revenue: number;
  expenses: number;
  result: number;
  filled: boolean;
};

export type MonthlyBarsProps = {
  months: readonly MonthlyBar[];
  /** Masque la valeur sous chaque mois, quand la place manque. */
  values?: boolean;
  className?: string;
};

/**
 * Résultat mensuel, en barres divergentes.
 *
 * Écrit à la main, sans bibliothèque : rien à charger depuis un CDN que la
 * politique de sécurité bloquerait, et le graphique s'imprime avec la page.
 *
 * Une colonne par mois, de part et d'autre d'une ligne de zéro : au-dessus en
 * vert quand le cabinet gagne, en dessous en rouge quand il perd. C'est la seule
 * question posée à ce graphique, et elle se lit sans lire un chiffre. Les mois
 * non saisis restent en creux — un trou dans la série veut dire « à remplir »,
 * pas « zéro ».
 */
export function MonthlyBars({ months, values = true, className }: MonthlyBarsProps) {
  const filled = months.filter((month) => month.filled);
  const span = Math.max(1, ...filled.map((month) => Math.abs(month.result)));

  const height = (value: number) => `${Math.min(100, (Math.abs(value) / span) * 100)}%`;

  return (
    <div className={clsx("grid gap-2", className)}>
      <div className="scroll-x">
        <div className="flex min-w-[34rem] items-stretch gap-2">
          {months.map((month) => {
            const positive = month.result >= 0;
            return (
              <div key={month.label} className="flex flex-1 flex-col items-center gap-1">
                {/* Moitié haute : bénéfice. */}
                <div className="flex h-24 w-full items-end justify-center">
                  {month.filled && positive ? (
                    <span
                      className="w-[74%] rounded-t-[5px] bg-ok"
                      style={{ height: height(month.result) }}
                      title={title(month)}
                    />
                  ) : null}
                </div>

                <span className="h-px w-full bg-line" aria-hidden="true" />

                {/* Moitié basse : perte. Les mois non saisis y laissent un tiret. */}
                <div className="flex h-14 w-full items-start justify-center">
                  {month.filled && !positive ? (
                    <span
                      className="w-[74%] rounded-b-[5px] bg-danger"
                      style={{ height: height(month.result) }}
                      title={title(month)}
                    />
                  ) : !month.filled ? (
                    <span className="mt-[3px] h-1.5 w-[74%] rounded-sm bg-surface2" title={`${month.label} — non saisi`} />
                  ) : null}
                </div>

                <span
                  className={clsx(
                    "text-2xs font-semibold",
                    month.filled ? "text-ink2" : "text-muted",
                  )}
                >
                  {month.label.slice(0, 3)}
                </span>
                {values ? (
                  <span className="text-2xs text-muted tabular">
                    {month.filled ? formatMad(month.result, { currency: false }) : "—"}
                  </span>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-4 text-2xs text-muted">
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-sm bg-ok" aria-hidden="true" /> Bénéfice
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-sm bg-danger" aria-hidden="true" /> Perte
        </span>
        <span className="flex items-center gap-1.5">
          <span
            className="h-2 w-2 rounded-sm border border-line bg-surface2"
            aria-hidden="true"
          />{" "}
          Non saisi
        </span>
      </div>
    </div>
  );
}

function title(month: MonthlyBar): string {
  return `${month.label} — revenus ${formatMad(month.revenue)}, charges ${formatMad(
    month.expenses,
  )}, résultat ${formatMad(month.result)}`;
}
