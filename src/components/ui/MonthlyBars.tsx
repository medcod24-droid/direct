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
  className?: string;
};

/**
 * Résultat mensuel, en barres.
 *
 * Rendu côté serveur, en SVG : aucune bibliothèque de graphiques, donc rien à
 * charger depuis un CDN que la politique de sécurité bloquerait, et le graphique
 * s'imprime avec la page.
 *
 * Une barre par mois, autour d'une ligne de zéro : au-dessus en vert quand le
 * cabinet gagne, en dessous en rouge quand il perd. C'est la seule question
 * qu'on pose à ce graphique, et elle se lit sans lire un chiffre. Les montants
 * sont dans l'infobulle et, en toutes lettres, dans le tableau qui suit.
 *
 * Les mois non saisis sont dessinés en creux : un trou dans la série est une
 * information — il reste à remplir —, pas un zéro.
 */
export function MonthlyBars({ months, className }: MonthlyBarsProps) {
  const width = 720;
  const height = 220;
  const padding = { top: 16, bottom: 28, left: 8, right: 8 };
  const plot = height - padding.top - padding.bottom;

  // L'échelle couvre le plus grand écart dans les deux sens, pour que le zéro
  // reste au même endroit d'un mois à l'autre.
  const extremes = months.filter((month) => month.filled).map((month) => month.result);
  const span = Math.max(1, ...extremes.map((value) => Math.abs(value)));
  const zeroY = padding.top + plot / 2;
  const scale = (value: number) => (value / span) * (plot / 2);

  const slot = (width - padding.left - padding.right) / months.length;
  const barWidth = Math.min(38, slot * 0.55);

  return (
    <div className={className}>
      <div className="scroll-x">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full min-w-[36rem]"
          role="img"
          aria-label="Résultat mensuel du cabinet"
        >
          <line
            x1={padding.left}
            x2={width - padding.right}
            y1={zeroY}
            y2={zeroY}
            className="stroke-line"
            strokeWidth={1}
          />

          {months.map((month, index) => {
            const center = padding.left + slot * index + slot / 2;
            const offset = scale(month.result);
            const top = month.result >= 0 ? zeroY - offset : zeroY;
            const barHeight = Math.max(month.filled ? 2 : 0, Math.abs(offset));
            const positive = month.result >= 0;

            return (
              <g key={month.label}>
                {month.filled ? (
                  <rect
                    x={center - barWidth / 2}
                    y={top}
                    width={barWidth}
                    height={barHeight}
                    rx={2}
                    className={positive ? "fill-ok" : "fill-danger"}
                  >
                    <title>
                      {`${month.label} — revenus ${formatMad(month.revenue)}, charges ${formatMad(
                        month.expenses,
                      )}, résultat ${formatMad(month.result)}`}
                    </title>
                  </rect>
                ) : (
                  <rect
                    x={center - barWidth / 2}
                    y={zeroY - 3}
                    width={barWidth}
                    height={6}
                    rx={2}
                    className="fill-line"
                  >
                    <title>{`${month.label} — non saisi`}</title>
                  </rect>
                )}

                <text
                  x={center}
                  y={height - 10}
                  textAnchor="middle"
                  className="fill-[var(--muted)] text-[10px]"
                >
                  {month.label.slice(0, 3)}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      <div className="mt-1 flex flex-wrap items-center gap-4 text-xs text-muted">
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-sm bg-ok" aria-hidden="true" /> bénéfice
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-sm bg-danger" aria-hidden="true" /> perte
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-sm bg-line" aria-hidden="true" /> mois non saisi
        </span>
      </div>
    </div>
  );
}
