import { z } from "zod";
import {
  ACTIVITY_STATES,
  CLIENT_KINDS,
  CLIENT_STATUSES,
  CLIENT_SUBTYPES,
  MANAGED_BY,
  PROPERTY_USAGES,
  subtypesFor,
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

/** Une date absente arrive comme `undefined` : le champ vide n'est pas une date. */
const optionalDate = () => z.coerce.date().optional();

/**
 * Immatriculation CNSS de la personne : neuf chiffres.
 * L'affiliation employeur (`cnssNo`) suit une autre forme et reste libre.
 */
export const cnssRegSchema = z
  .string()
  .trim()
  .regex(/^[0-9]{9}$/, "L'immatriculation CNSS comporte 9 chiffres.")
  .optional()
  .or(z.literal("").transform(() => undefined));

/** Une liste vide et une liste absente sont équivalentes : le défaut suffit. */
const list = <T extends z.ZodTypeAny>(item: T, max = 20) => z.array(item).max(max).default([]);

/**
 * Immatriculation au registre de commerce, avec ce qui en dépend.
 *
 * L'imbrication suit le droit : une immatriculation (principale ou secondaire)
 * relève d'un tribunal ; les établissements ouverts dans le même ressort lui
 * restent rattachés ; et la taxe professionnelle se rattache à l'établissement,
 * puisqu'elle est établie au lieu de chacun d'eux et que son numéro doit y être
 * affiché (loi 47-06, art. 8 et 14). L'établissement principal porte donc lui
 * aussi ses numéros de taxe — sans quoi le dossier le plus courant, un local
 * unique sans succursale, n'aurait nulle part où les inscrire.
 */
/**
 * Identifiant stable d'une ligne d'une liste.
 *
 * Il ne sert pas à la base — le contenu reste du JSON — mais à rattacher un
 * justificatif à *cette* ligne-là. Un indice de position ne le permettrait pas :
 * retirer une succursale renumérote celles qui suivent, et le scan du registre
 * se retrouverait accroché au mauvais établissement. Émis par le navigateur,
 * réémis par le serveur s'il manque ou se répète.
 */
export const rowIdSchema = z
  .string()
  .trim()
  .regex(/^[A-Za-z0-9_-]{4,36}$/)
  .optional()
  .or(z.literal("").transform(() => undefined));

const taxProfSchema = z.object({
  id: rowIdSchema,
  value: trimmed(40).min(1, "Numéro de taxe professionnelle vide."),
});
const taxProfList = z.array(taxProfSchema).max(20).default([]);

export const branchSchema = z.object({
  id: rowIdSchema,
  number: trimmed(40).min(1, "Numéro de succursale requis."),
  court: optionalText(80),
  taxProfNos: taxProfList,
});

export const registrationSchema = z.object({
  id: rowIdSchema,
  number: trimmed(40).min(1, "Numéro de registre de commerce requis."),
  court: optionalText(80),
  taxProfNos: taxProfList,
  branches: z.array(branchSchema).max(20).default([]),
});

/**
 * Salarié déclaré à la CNSS.
 *
 * Ce sont des données personnelles de tiers, que le client confie au cabinet :
 * la CIN suit le même mode CNDP que celle du gérant, et rien d'autre n'est
 * demandé que ce qui sert la déclaration.
 */
export const employeeSchema = z.object({
  name: trimmed(120).min(2, "Nom du salarié requis."),
  cin: optionalText(20),
  cnssNo: z
    .string()
    .trim()
    .regex(/^[0-9]{9}$/, "L'immatriculation CNSS comporte 9 chiffres.")
    .optional()
    .or(z.literal("").transform(() => undefined)),
});

/**
 * Associé ou gérant.
 *
 * `cin` identifie une personne physique : il n'est conservé qu'en mode
 * « autorisation » CNDP, exactement comme la CIN du gérant. Le filtrage est
 * appliqué côté service, pas ici, pour que la règle vive à un seul endroit.
 */
export const partnerSchema = z.object({
  id: rowIdSchema,
  role: z.enum(["gerant", "associe"]).default("associe"),
  name: trimmed(120).min(2, "Nom de l'associé requis."),
  cin: optionalText(20),
  address: optionalText(300),
  phone: optionalText(40),
});

/**
 * Article d'imposition d'un particulier : un par bien imposé.
 *
 * Rien n'est exigé ligne par ligne — le comptable saisit ce qu'il a et complète
 * plus tard — mais une ligne entièrement vide n'est pas conservée : elle est
 * écartée à la lecture du formulaire.
 */
export const articleSchema = z.object({
  id: rowIdSchema,
  number: optionalText(40),
  designation: optionalText(120),
  address: optionalText(300),
  usage: z.enum(PROPERTY_USAGES).default("principale"),
});

export const clientSchema = z.object({
  kind: z.enum(CLIENT_KINDS),
  subtype: z.enum(CLIENT_SUBTYPES),
  /** Nom de la forme quand `subtype = "autre"`. */
  subtypeOther: optionalText(80),
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
  /** Dossier apporté par un autre client du cabinet. Vérifié côté service. */
  referredById: optionalText(40),
  status: z.enum(CLIENT_STATUSES).default("active"),
  activityState: z.enum(ACTIVITY_STATES).default("running"),
  priority: z.enum(PRIORITIES).default("normal"),
  notes: optionalText(4000),
  feeAmount: z.coerce.number().int().min(0).optional(),
  feeFrequency: z.enum(["monthly", "quarterly", "yearly", "none"]).optional(),

  authorizationNo: optionalText(40),
  employeeCount: z.coerce.number().int().min(0).max(100000).optional(),

  // Personne physique
  taxDistrict: optionalText(80),
  signNo: optionalText(40),
  signRefDate: optionalDate(),
  signExpiresAt: optionalDate(),
  personalAddress: optionalText(300),
  cnssRegNo: cnssRegSchema,
  cnssAffiliatedAt: optionalDate(),
  startedAt: optionalDate(),

  // Personne morale
  negCertNo: optionalText(40),
  negCertDate: optionalDate(),
  negCertExpiresAt: optionalDate(),
  isDomiciled: z.coerce.boolean().default(false),

  // Listes
  activities: list(trimmed(200).min(1, "Activité vide.")),
  registrations: list(registrationSchema),
  partners: list(partnerSchema),
  employees: list(employeeSchema, 200),
  articles: list(articleSchema, 50),
});

/**
 * Cohérence entre le type de personne et la forme juridique.
 *
 * La règle est posée ici plutôt que dans le formulaire : l'écran filtre déjà la
 * liste des formes, mais rien n'empêche d'envoyer la requête à la main, et la
 * fiche affichée dépend de `kind`. Portée séparément pour que `clientSchema`
 * reste un objet et garde `.partial()`.
 */
function checkSubtype(
  data: { kind?: string; subtype?: string },
  ctx: z.RefinementCtx,
) {
  if (!data.kind || !data.subtype) return;
  const allowed = subtypesFor(data.kind as "company" | "individual");
  if (!allowed.includes(data.subtype as (typeof allowed)[number])) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["subtype"],
      message:
        data.kind === "individual"
          ? "Cette forme est réservée aux personnes morales."
          : "Cette forme est réservée aux personnes physiques.",
    });
  }
}

export const clientCreateSchema = clientSchema.superRefine(checkSubtype);
export const clientUpdateSchema = clientSchema.partial().superRefine(checkSubtype);

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

/**
 * Ajout direct d'un collaborateur par l'administration.
 *
 * Il n'y a plus d'invitation par lien : sans envoi de courriel, elle revenait à
 * recopier une adresse à la main pour le même résultat. Le mot de passe initial
 * suit la même politique que les autres — il ouvre les dossiers du cabinet.
 */
export const addMemberSchema = z.object({
  name: trimmed(120).min(2, "Nom du collaborateur requis."),
  email: z.string().trim().toLowerCase().email("Adresse e-mail invalide."),
  password: z.string().min(12, "Au moins 12 caractères."),
  role: z.enum(["admin", "accountant", "assistant"], {
    errorMap: () => ({ message: "Rôle invalide." }),
  }),
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

export const cabinetSettingsSchema = z.object({
  name: trimmed(200).min(2, "Nom du cabinet requis."),
  ice: iceSchema,
  if: ifSchema,
  rc: optionalText(40),
  ordre: z.enum(["OPCA", "OEC"]).optional().or(z.literal("").transform(() => undefined)),
  ordreNum: optionalText(40),
  city: optionalText(80),
  phone: optionalText(40),
  email: z.string().trim().email("E-mail invalide.").optional().or(z.literal("").transform(() => undefined)),
  /** « autorisation » débloque l'enregistrement du CIN des gérants (loi 09-08). */
  cndpMode: z.enum(["declaration", "authorization"]),
  cndpRef: optionalText(60),
});
