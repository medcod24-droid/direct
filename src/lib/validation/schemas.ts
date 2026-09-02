import { z } from "zod";
import {
  ACTIVITY_STATES,
  CLIENT_KINDS,
  CLIENT_STATUSES,
  CLIENT_SUBTYPES,
  MANAGED_BY,
  PRIORITIES,
  ROLES,
  TASK_STATUSES,
  TAX_REGIMES,
  VAT_REGIMES,
} from "@/lib/domain/enums";

/**
 * Toute donnée entrante est validée ici, côté serveur. La validation du navigateur
 * n'est qu'un confort : elle n'est jamais la seule barrière.
 */

const trimmed = (max: number) => z.string().trim().max(max);
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => (v === "" ? undefined : v));

/** ICE marocain : 15 chiffres. La clé de contrôle n'est pas vérifiée (règle non confirmée). */
export const iceSchema = z
  .string()
  .trim()
  .regex(/^[0-9]{15}$/, "L'ICE doit comporter 15 chiffres.")
  .optional()
  .or(z.literal("").transform(() => undefined));

export const ifSchema = z
  .string()
  .trim()
  .regex(/^[0-9]{1,15}$/, "L'identifiant fiscal ne doit contenir que des chiffres.")
  .optional()
  .or(z.literal("").transform(() => undefined));

export const signupSchema = z.object({
  cabinetName: trimmed(120).min(2, "Nom du cabinet requis."),
  ordre: z.enum(["OPCA", "OEC"], {
    errorMap: () => ({ message: "Sélectionnez votre ordre professionnel." }),
  }),
  // Exigé à l'inscription : depuis le 21 août 2025, exercer sans inscription est illégal.
  ordreNum: trimmed(40).min(2, "Numéro d'inscription requis."),
  name: trimmed(120).min(2, "Votre nom est requis."),
  email: z.string().trim().toLowerCase().email("Adresse e-mail invalide."),
  password: z.string().min(12, "Au moins 12 caractères."),
  acceptTerms: z.literal(true, {
    errorMap: () => ({ message: "Vous devez accepter les conditions." }),
  }),
});

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("Adresse e-mail invalide."),
  password: z.string().min(1, "Mot de passe requis."),
});

export const clientSchema = z.object({
  kind: z.enum(CLIENT_KINDS),
  subtype: z.enum(CLIENT_SUBTYPES),
  legalName: trimmed(200).min(2, "Raison sociale ou nom requis."),
  tradeName: optionalText(200),
  ice: iceSchema,
  if: ifSchema,
  rc: optionalText(40),
  rcCourt: optionalText(80),
  taxProfNo: optionalText(40),
  cnssNo: optionalText(40),
  managerName: optionalText(120),
  /** Stocké uniquement en mode « autorisation » CNDP (voir cabinet.cndpMode). */
  managerCin: optionalText(20),
  address: optionalText(300),
  city: optionalText(80),
  phone: optionalText(40),
  email: z.string().trim().email("E-mail invalide.").optional().or(z.literal("").transform(() => undefined)),
  website: optionalText(200),
  activity: optionalText(200),
  fiscalYearEndMonth: z.coerce.number().int().min(1).max(12).default(12),
  fiscalYearEndDay: z.coerce.number().int().min(1).max(31).default(31),
  vatRegime: z.enum(VAT_REGIMES).default("quarterly"),
  taxRegime: z.enum(TAX_REGIMES).default("is"),
  isEmployer: z.coerce.boolean().default(false),
  referenceRevenue: z.coerce.number().int().min(0).optional(),
  takeoverDate: z.coerce.date(),
  status: z.enum(CLIENT_STATUSES).default("active"),
  activityState: z.enum(ACTIVITY_STATES).default("running"),
  priority: z.enum(PRIORITIES).default("normal"),
  notes: optionalText(4000),
  feeAmount: z.coerce.number().int().min(0).optional(),
  feeFrequency: z.enum(["monthly", "quarterly", "yearly", "none"]).optional(),
});

export const contactSchema = z.object({
  clientId: z.string().min(1),
  name: trimmed(120).min(2),
  position: optionalText(120),
  phone: optionalText(40),
  email: z.string().trim().email().optional().or(z.literal("").transform(() => undefined)),
  isPrimary: z.coerce.boolean().default(false),
  notes: optionalText(1000),
});

export const documentRequestSchema = z.object({
  clientId: z.string().min(1),
  title: trimmed(200).min(2, "Intitulé requis."),
  description: optionalText(2000),
  periodLabel: optionalText(60),
  dueDate: z.coerce.date().optional(),
});

export const reviewSchema = z.object({
  requestId: z.string().min(1),
  decision: z.enum(["approve", "reject"]),
  reason: optionalText(500),
});

export const taskSchema = z.object({
  clientId: z.string().optional(),
  title: trimmed(200).min(2, "Titre requis."),
  description: optionalText(4000),
  priority: z.enum(PRIORITIES).default("normal"),
  status: z.enum(TASK_STATUSES).default("todo"),
  dueDate: z.coerce.date().optional(),
  assigneeId: z.string().optional(),
});

export const deadlineUpdateSchema = z.object({
  deadlineId: z.string().min(1),
  action: z.enum(["declare", "pay", "reopen", "not_applicable"]),
  proofDocumentId: z.string().optional(),
  notes: optionalText(1000),
});

export const deadlineManagedBySchema = z.object({
  deadlineId: z.string().min(1),
  managedBy: z.enum(MANAGED_BY),
});

export const invoiceSchema = z.object({
  clientId: z.string().min(1),
  reference: trimmed(40).min(1, "Référence requise."),
  label: optionalText(200),
  amount: z.coerce.number().int().min(1, "Montant requis."),
  vatRate: z.coerce.number().int().min(0).max(100).default(20),
  issuedAt: z.coerce.date(),
  dueDate: z.coerce.date(),
  notes: optionalText(1000),
});

export const paymentSchema = z.object({
  invoiceId: z.string().min(1),
  amount: z.coerce.number().int().min(1),
  paidAt: z.coerce.date(),
  paymentMode: z.enum(["cash", "cheque", "transfer", "card"]),
});

export const inviteSchema = z.object({
  email: z.string().trim().toLowerCase().email("Adresse e-mail invalide."),
  role: z.enum(ROLES).refine((r) => r !== "owner", "Le rôle propriétaire ne s'invite pas."),
  restrictedToAssigned: z.coerce.boolean().default(false),
});

export const messageSchema = z.object({
  clientId: z.string().min(1),
  body: trimmed(4000).min(1, "Message vide."),
  isInternal: z.coerce.boolean().default(false),
});

export const searchSchema = z.object({
  q: optionalText(120),
  status: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(100).default(25),
});
