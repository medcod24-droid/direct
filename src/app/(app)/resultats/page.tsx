import { requireStaff } from "@/lib/authz/guard";
import { formatMad, formatPercent } from "@/lib/format";
import { getYearResults, listResultYears } from "@/server/services/finances";
import {
  Badge,
  Button,
  Card,
  MonthlyBars,
  PageHeader,
  Table,
  TBody,
  TD,
  TH,
  THead,
  TR,
} from "@/components/ui";
import { EditMonth, MonthForm } from "./MonthForm";

export const metadata = { title: "Résultat — Direct Conseil" };
export const dynamic = "force-dynamic";

type Search = Promise<Record<string, string | string[] | undefined>>;

/**
 * Résultat du cabinet, mois par mois.
 *
 * Le graphique répond à une seule question — le cabinet gagne-t-il ou perd-il ce
 * mois-ci — et le tableau donne les chiffres, avec le cumul depuis janvier, qui
 * est la façon dont un comptable lit son propre exercice.
 */
export default async function ResultatsPage({ searchParams }: { searchParams: Search }) {
  const ctx = await requireStaff("finance.view");
  const params = await searchParams;
  const canManage = ctx.can("finance.manage");

  const now = new Date();
  const raw = Array.isArray(params.year) ? params.year[0] : params.year;
  const parsed = Number(raw);
  const year =
    Number.isInteger(parsed) && parsed >= 2000 && parsed <= 2100 ? parsed : now.getUTCFullYear();

  const [data, years] = await Promise.all([getYearResults(ctx, year), listResultYears(ctx, now)]);
  const { totals } = data;
  const margin = totals.revenue > 0 ? totals.result / totals.revenue : null;

  return (
    <div className="grid gap-5">
      <PageHeader
        title="Résultat du cabinet"
        subtitle="Ce que le cabinet gagne et dépense, mois par mois. Saisie manuelle : facturé n'est pas encaissé."
        actions={
          canManage ? (
            <MonthForm year={year} months={data.months} trigger="Saisir un mois" />
          ) : undefined
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        {years.map((value) => (
          <Button
            key={value}
            href={`/resultats?year=${value}`}
            variant={value === year ? "secondary" : "ghost"}
            size="sm"
          >
            {value}
          </Button>
        ))}
      </div>

      <Card
        title={`Exercice ${year}`}
        description={
          totals.monthsFilled === 0
            ? "Aucun mois saisi pour l'instant."
            : `${totals.monthsFilled} mois saisi(s) · résultat cumulé ${formatMad(totals.result)}`
        }
      >
        <MonthlyBars months={data.months} />

        <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Figure label="Revenus" value={formatMad(totals.revenue)} />
          <Figure label="Charges" value={formatMad(totals.expenses)} />
          <Figure
            label="Résultat"
            value={formatMad(totals.result)}
            tone={totals.result >= 0 ? "ok" : "danger"}
          />
          <Figure
            label="Marge"
            value={margin === null ? "—" : formatPercent(margin)}
            tone={margin !== null && margin < 0 ? "danger" : undefined}
          />
        </dl>

        {data.best && data.worst && totals.monthsFilled > 1 ? (
          <p className="mt-3 text-xs text-muted">
            Meilleur mois : {data.best.label} ({formatMad(data.best.result)}) · mois le plus
            faible : {data.worst.label} ({formatMad(data.worst.result)}) · moyenne{" "}
            {formatMad(data.average)} par mois saisi.
          </p>
        ) : null}
      </Card>

      <Card title="Détail" padded={false}>
        <Table label={`Résultat mensuel ${year}`} minWidth={760}>
          <THead>
            <TR>
              <TH>Mois</TH>
              <TH>Revenus</TH>
              <TH>Charges</TH>
              <TH>Résultat</TH>
              <TH>Cumul</TH>
              <TH>Remarque</TH>
              {canManage ? <TH>Actions</TH> : null}
            </TR>
          </THead>
          <TBody>
            {data.months.map((month) => (
              <TR key={month.month}>
                <TD>
                  {month.label}
                  {!month.filled ? (
                    <Badge className="ms-2">non saisi</Badge>
                  ) : null}
                </TD>
                <TD className="tabular">{month.filled ? formatMad(month.revenue) : "—"}</TD>
                <TD className="tabular">{month.filled ? formatMad(month.expenses) : "—"}</TD>
                <TD
                  className={
                    "tabular " +
                    (!month.filled ? "" : month.result >= 0 ? "text-ok" : "text-danger")
                  }
                >
                  {month.filled ? formatMad(month.result) : "—"}
                </TD>
                <TD
                  className={"tabular " + (month.cumulative >= 0 ? "text-ink2" : "text-danger")}
                >
                  {formatMad(month.cumulative)}
                </TD>
                <TD className="text-xs text-muted">{month.notes ?? ""}</TD>
                {canManage ? (
                  <TD>
                    <EditMonth year={year} months={data.months} month={month} />
                  </TD>
                ) : null}
              </TR>
            ))}
          </TBody>
        </Table>
      </Card>
    </div>
  );
}

function Figure({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "ok" | "danger";
}) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-muted">{label}</dt>
      <dd
        className={
          "mt-0.5 text-lg font-semibold tabular " +
          (tone === "ok" ? "text-ok" : tone === "danger" ? "text-danger" : "text-ink")
        }
      >
        {value}
      </dd>
    </div>
  );
}
