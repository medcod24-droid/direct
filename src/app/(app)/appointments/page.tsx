import Link from "next/link";
import { requireStaff } from "@/lib/authz/guard";
import {
  dayKey,
  formatMonth,
  monthGrid,
  monthRange,
  monthTitle,
  parseMonth,
  shiftMonth,
  wallDateLong,
  wallTime,
  WEEKDAY_LABELS,
} from "@/lib/calendar/month";
import { listAppointments, listAwaitingReview } from "@/server/services/appointments";
import { listClientOptions } from "@/server/services/clients";
import { listStaffOptions } from "@/server/services/members";
import { Alert, Button, Card, EmptyState, Field, PageHeader, SearchPicker, Select } from "@/components/ui";
import type { PickerOption } from "@/components/ui";
import { AppointmentCard, type AppointmentItem } from "./AppointmentActions";
import { AppointmentForm } from "./AppointmentForm";

export const metadata = { title: "Rendez-vous — Direct Conseil" };
export const dynamic = "force-dynamic";

type Search = Promise<Record<string, string | string[] | undefined>>;

const one = (value: string | string[] | undefined) =>
  (Array.isArray(value) ? value[0] : value) || undefined;

/**
 * Calendrier des rendez-vous.
 *
 * Le mois, le jour affiché et les filtres passent par l'URL : une vue se
 * partage, se met en signet et survit à un rechargement. Le rendu est serveur,
 * sans bibliothèque de calendrier — la grille est un module pur, testé, et rien
 * n'est chargé depuis un CDN que la politique de sécurité bloquerait.
 *
 * Les heures sont des heures murales, lues en UTC sans conversion : un
 * rendez-vous saisi à 9 h s'affiche à 9 h quel que soit le fuseau du serveur.
 */
export default async function AppointmentsPage({ searchParams }: { searchParams: Search }) {
  const ctx = await requireStaff("appointment.view");
  const params = await searchParams;

  const now = new Date();
  const today = dayKey(now);
  const selected = parseMonth(one(params.month)) ?? {
    year: now.getUTCFullYear(),
    month: now.getUTCMonth(),
  };
  const { from, to } = monthRange(selected.year, selected.month);

  const clientId = one(params.client);
  const assignedToId = one(params.staff);
  const status = one(params.status) ?? "all";
  const day = one(params.day);

  const canManage = ctx.can("appointment.manage");

  const [appointments, awaiting, clientRows, members] = await Promise.all([
    listAppointments(ctx, { from, to, clientId, assignedToId, status }),
    listAwaitingReview(ctx, now),
    // Le champ de recherche filtre dans le navigateur : il reçoit la clé de
    // recherche de chaque dossier, pas seulement son nom.
    listClientOptions(ctx),
    listStaffOptions(ctx),
  ]);

  const clients = clientRows;
  const staff = members;

  const byDay = new Map<string, AppointmentItem[]>();
  for (const appointment of appointments) {
    const key = dayKey(appointment.startsAt);
    const list = byDay.get(key);
    if (list) list.push(appointment);
    else byDay.set(key, [appointment]);
  }

  const weeks = monthGrid(selected.year, selected.month);
  const previous = shiftMonth(selected.year, selected.month, -1);
  const next = shiftMonth(selected.year, selected.month, 1);

  /** Conserve les filtres en changeant de mois ou de jour. */
  const link = (changes: Record<string, string | undefined>) => {
    const query = new URLSearchParams();
    const base: Record<string, string | undefined> = {
      month: formatMonth(selected.year, selected.month),
      client: clientId,
      staff: assignedToId,
      status: status === "all" ? undefined : status,
      day,
      ...changes,
    };
    for (const [key, value] of Object.entries(base)) if (value) query.set(key, value);
    const search = query.toString();
    return search ? `/appointments?${search}` : "/appointments";
  };

  // Le panneau de droite : le jour choisi, sinon ce qui vient.
  const upcoming = appointments
    .filter((appointment) => appointment.startsAt >= now && appointment.status === "scheduled")
    .slice(0, 12);
  const dayList = day ? byDay.get(day) ?? [] : [];

  return (
    <div className="grid gap-5">
      <PageHeader
        title="Rendez-vous"
        subtitle="Le planning du cabinet. Un rendez-vous validé verse son compte rendu dans la liste d'activité du client."
        actions={
          canManage ? (
            <AppointmentForm
              clients={clients}
              staff={staff}
              defaultDay={day ?? today}
              trigger="Nouveau rendez-vous"
            />
          ) : undefined
        }
      />

      {awaiting.length > 0 ? (
        <Alert tone="warning">
          {awaiting.length === 1
            ? "1 rendez-vous passé attend sa validation."
            : `${awaiting.length} rendez-vous passés attendent leur validation.`}{" "}
          Tant qu&apos;ils ne sont pas validés, leur compte rendu n&apos;est écrit nulle part.
        </Alert>
      ) : null}

      <Card>
        <form className="grid gap-3 sm:grid-cols-4">
          <input type="hidden" name="month" value={formatMonth(selected.year, selected.month)} />
          <Field label="Client" htmlFor="client">
            <SearchPicker
              id="client"
              name="client"
              options={clients}
              defaultValue={clientId ?? ""}
              emptyLabel="Tous les dossiers"
              placeholder="Tous les dossiers"
            />
          </Field>
          <Field label="Collaborateur" htmlFor="staff">
            <Select id="staff" name="staff" defaultValue={assignedToId ?? ""}>
              <option value="">Tous</option>
              {staff.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="État" htmlFor="status">
            <Select id="status" name="status" defaultValue={status}>
              <option value="all">Tous</option>
              <option value="scheduled">Prévus</option>
              <option value="done">Validés</option>
              <option value="no_show">Clients absents</option>
              <option value="cancelled">Annulés</option>
            </Select>
          </Field>
          <div className="flex items-end gap-2">
            <Button type="submit" variant="secondary">
              Filtrer
            </Button>
            <Button href="/appointments" variant="ghost">
              Réinitialiser
            </Button>
          </div>
        </form>
      </Card>

      <div className="grid gap-4 lg:grid-cols-[1fr_22rem]">
        <Card
          title={monthTitle(selected.year, selected.month)}
          action={
            <div className="flex gap-1">
              <Button href={link({ month: formatMonth(previous.year, previous.month), day: undefined })} variant="ghost" size="sm">
                ← Mois précédent
              </Button>
              <Button href={link({ month: formatMonth(now.getUTCFullYear(), now.getUTCMonth()), day: undefined })} variant="ghost" size="sm">
                Aujourd&apos;hui
              </Button>
              <Button href={link({ month: formatMonth(next.year, next.month), day: undefined })} variant="ghost" size="sm">
                Mois suivant →
              </Button>
            </div>
          }
        >
          <div className="scroll-x">
            <div className="min-w-[42rem]">
              <div className="grid grid-cols-7 gap-1 pb-1 text-center text-xs text-muted">
                {WEEKDAY_LABELS.map((label) => (
                  <div key={label}>{label}</div>
                ))}
              </div>

              <div className="grid grid-cols-7 gap-1">
                {weeks.flat().map((cell) => {
                  const items = byDay.get(cell.key) ?? [];
                  const isToday = cell.key === today;
                  const isSelected = cell.key === day;
                  return (
                    <Link
                      key={cell.key}
                      href={link({ day: isSelected ? undefined : cell.key })}
                      className={[
                        "min-h-24 rounded-md border p-1.5 text-start transition-colors",
                        cell.inMonth ? "bg-surface" : "bg-surface2 opacity-60",
                        isSelected
                          ? "border-accent"
                          : isToday
                            ? "border-accent/50"
                            : "border-line hover:border-[var(--muted)]",
                      ].join(" ")}
                    >
                      <div
                        className={
                          "text-xs tabular " +
                          (isToday ? "font-semibold text-accent" : "text-muted")
                        }
                      >
                        {cell.dayOfMonth}
                      </div>
                      <div className="mt-1 grid gap-0.5">
                        {items.slice(0, 3).map((appointment) => (
                          <div
                            key={appointment.id}
                            className={
                              "truncate rounded px-1 py-0.5 text-[11px] " +
                              (appointment.status === "done"
                                ? "bg-okSoft text-ok"
                                : appointment.status === "scheduled"
                                  ? "bg-accentSoft text-accent"
                                  : "bg-surface2 text-muted line-through")
                            }
                            title={`${wallTime(appointment.startsAt)} — ${appointment.client.legalName} — ${appointment.title}`}
                          >
                            {wallTime(appointment.startsAt)} {appointment.client.legalName}
                          </div>
                        ))}
                        {items.length > 3 ? (
                          <div className="px-1 text-[11px] text-muted">
                            +{items.length - 3} autre(s)
                          </div>
                        ) : null}
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>
          </div>
        </Card>

        <Card
          title={day ? wallDateLong(new Date(`${day}T00:00:00Z`)) : "À venir ce mois-ci"}
          description={
            day
              ? "Cliquez de nouveau sur la case du jour pour revenir à la liste à venir."
              : undefined
          }
        >
          <AppointmentList
            items={day ? dayList : upcoming}
            clients={clients}
            staff={staff}
            canManage={canManage}
            now={now.getTime()}
            empty={day ? "Aucun rendez-vous ce jour-là." : "Aucun rendez-vous à venir ce mois-ci."}
          />
        </Card>
      </div>

      {awaiting.length > 0 ? (
        <Card
          title="En attente de validation"
          description="Rendez-vous passés dont le compte rendu n'a pas encore été écrit."
        >
          <AppointmentList
            items={awaiting}
            clients={clients}
            staff={staff}
            canManage={canManage}
            now={now.getTime()}
            empty="Rien à valider."
          />
        </Card>
      ) : null}
    </div>
  );
}

function AppointmentList({
  items,
  clients,
  staff,
  canManage,
  now,
  empty,
}: {
  items: AppointmentItem[];
  clients: PickerOption[];
  staff: PickerOption[];
  canManage: boolean;
  now: number;
  empty: string;
}) {
  if (items.length === 0) return <EmptyState title={empty} />;
  return (
    <div className="grid gap-2">
      {items.map((appointment) => (
        <AppointmentCard
          key={appointment.id}
          appointment={appointment}
          clients={clients}
          staff={staff}
          canManage={canManage}
          now={now}
        />
      ))}
    </div>
  );
}
