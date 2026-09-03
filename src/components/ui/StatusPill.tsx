import type { INVOICE_STATUSES } from "@/lib/domain/enums";
import type { DeadlineStatus, Health, RequestStatus, TaskStatus } from "@/lib/domain/enums";
import { getDictionary, t, type Locale, type TranslationKey } from "@/lib/i18n";
import { Badge, type Tone } from "./Badge";

/** `INVOICE_STATUSES` n'expose pas de type nommé dans le domaine. */
export type InvoiceStatus = (typeof INVOICE_STATUSES)[number];

export type StatusKind = "deadline" | "task" | "request" | "invoice" | "health" | "document";

export type DomainStatus = DeadlineStatus | TaskStatus | RequestStatus | InvoiceStatus | Health;

type StatusKey = Extract<TranslationKey, `status.${string}`>;
type Entry = { tone: Tone; key: StatusKey };

/**
 * Les couleurs sémantiques portent une information de conformité :
 * vert = obligation satisfaite, ambre = action requise, rouge = hors délai.
 * Tout le reste reste neutre ou accent.
 */
const DEADLINE: Record<DeadlineStatus, Entry> = {
  upcoming: { tone: "neutral", key: "status.deadline.upcoming" },
  in_progress: { tone: "accent", key: "status.deadline.in_progress" },
  declared: { tone: "accent", key: "status.deadline.declared" },
  paid: { tone: "green", key: "status.deadline.paid" },
  overdue: { tone: "red", key: "status.deadline.overdue" },
  not_applicable: { tone: "neutral", key: "status.deadline.not_applicable" },
};

const TASK: Record<TaskStatus, Entry> = {
  todo: { tone: "neutral", key: "status.task.todo" },
  in_progress: { tone: "accent", key: "status.task.in_progress" },
  waiting_client: { tone: "amber", key: "status.task.waiting_client" },
  done: { tone: "green", key: "status.task.done" },
  cancelled: { tone: "neutral", key: "status.task.cancelled" },
};

const REQUEST: Record<RequestStatus, Entry> = {
  pending: { tone: "neutral", key: "status.request.pending" },
  submitted: { tone: "accent", key: "status.request.submitted" },
  approved: { tone: "green", key: "status.request.approved" },
  rejected: { tone: "red", key: "status.request.rejected" },
  cancelled: { tone: "neutral", key: "status.request.cancelled" },
};

const INVOICE: Record<InvoiceStatus, Entry> = {
  pending: { tone: "neutral", key: "status.invoice.pending" },
  partial: { tone: "amber", key: "status.invoice.partial" },
  paid: { tone: "green", key: "status.invoice.paid" },
  overdue: { tone: "red", key: "status.invoice.overdue" },
  cancelled: { tone: "neutral", key: "status.invoice.cancelled" },
};

/** Les documents n'avaient pas de table : leurs statuts s'affichaient en anglais. */
const DOCUMENT: Record<string, Entry> = {
  received: { tone: "neutral", key: "status.document.received" },
  approved: { tone: "green", key: "status.document.approved" },
  rejected: { tone: "red", key: "status.document.rejected" },
  archived: { tone: "neutral", key: "status.document.archived" },
};

const HEALTH: Record<Health, Entry> = {
  green: { tone: "green", key: "status.health.green" },
  amber: { tone: "amber", key: "status.health.amber" },
  red: { tone: "red", key: "status.health.red" },
};

const BY_KIND: Record<StatusKind, Record<string, Entry>> = {
  deadline: DEADLINE,
  task: TASK,
  request: REQUEST,
  invoice: INVOICE,
  health: HEALTH,
  document: DOCUMENT,
};

/**
 * Table utilisée lorsque `kind` n'est pas précisé. Seuls `paid` et `pending`
 * sont réellement ambigus entre domaines : ils prennent ici la lecture
 * « échéance » et « demande ». Passer `kind` pour lever le doute.
 */
const FALLBACK: Record<string, Entry> = {
  ...INVOICE,
  ...DOCUMENT,
  ...TASK,
  ...REQUEST,
  ...DEADLINE,
  ...HEALTH,
};

export type StatusPillProps = {
  /**
   * SQLite ne porte pas d'enums : les statuts remontent de la base en `string`.
   * Le type reste ouvert pour cette raison, tout en gardant l'autocomplétion
   * sur les valeurs connues. Une valeur inconnue est rendue telle quelle,
   * en neutre — jamais en couleur de conformité.
   */
  status: DomainStatus | (string & {});
  /** Lève l'ambiguïté de `paid` et `pending`, partagés par deux domaines. */
  kind?: StatusKind;
  /** Infobulle explicative (motifs d'un état de santé, par exemple). */
  title?: string;
  locale?: Locale;
  className?: string;
};

function entryOf(kind: StatusKind | undefined, status: string): Entry | undefined {
  const scoped = kind ? BY_KIND[kind]?.[status] : undefined;
  return scoped ?? FALLBACK[status];
}

export function StatusPill({ status, kind, title, locale = "fr", className }: StatusPillProps) {
  const dict = getDictionary(locale);
  const entry = entryOf(kind, status);
  const label = entry ? t(dict, entry.key) : status;

  return (
    <Badge
      tone={entry?.tone ?? "neutral"}
      className={className}
      title={title ?? t(dict, "a11y.statusOf", { status: label })}
    >
      {label}
    </Badge>
  );
}
