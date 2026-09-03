/**
 * Données de référence : plans, catégories de documents, règles d'échéances système,
 * et un cabinet de démonstration en développement.
 *
 * Les règles d'échéances portent leur référence légale et un statut de vérification.
 * « verified » = confronté au texte (CGI 2026, loi 47-06, loi 5-96, communiqués DGI) ;
 * « to_confirm » = source secondaire, à faire valider par un professionnel inscrit avant
 * de s'y fier. Ce statut est visible dans l'application, jamais masqué.
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const db = new PrismaClient();

const PLANS = [
  {
    // Phase de lancement : le produit est gratuit et sans limite. Les plans payants
    // restent en base (isPublic: false) pour être réactivés sans migration le jour
    // où un prestataire de paiement marocain sera branché.
    code: "free",
    name: "Gratuit",
    priceMad: 0,
    maxClients: null,
    maxUsers: null,
    maxStorageMb: null,
    maxMonthlyUploads: null,
    features: ["clients", "documents", "deadlines", "requests", "tasks", "dashboard", "invoices", "portal"],
    sortOrder: 0,
  },
  {
    code: "starter",
    name: "Starter",
    priceMad: 19900,
    maxClients: 60,
    maxUsers: 2,
    maxStorageMb: 5000,
    maxMonthlyUploads: 500,
    features: ["clients", "documents", "deadlines", "requests", "tasks"],
    isPublic: false,
    sortOrder: 1,
  },
  {
    code: "professional",
    name: "Cabinet",
    priceMad: 44900,
    maxClients: 120,
    maxUsers: 5,
    maxStorageMb: 50000,
    maxMonthlyUploads: 3000,
    features: ["clients", "documents", "deadlines", "requests", "tasks", "dashboard", "invoices", "portal"],
    isPublic: false,
    sortOrder: 2,
  },
  {
    code: "business",
    name: "Pro",
    priceMad: 89900,
    maxClients: null,
    maxUsers: 15,
    maxStorageMb: 200000,
    maxMonthlyUploads: null,
    features: ["clients", "documents", "deadlines", "requests", "tasks", "dashboard", "invoices", "portal", "api", "multi_site"],
    isPublic: false,
    sortOrder: 3,
  },
  {
    code: "enterprise",
    name: "Réseau",
    priceMad: 0,
    maxClients: null,
    maxUsers: null,
    maxStorageMb: null,
    maxMonthlyUploads: null,
    features: ["clients", "documents", "deadlines", "requests", "tasks", "dashboard", "invoices", "portal", "api", "multi_site", "sso"],
    isPublic: false,
    sortOrder: 4,
  },
];

const CATEGORIES = [
  { code: "permanent", name: "Dossier permanent", kind: "permanent", sortOrder: 1 },
  { code: "achats", name: "Factures d'achat", kind: "recurring", sortOrder: 2 },
  { code: "ventes", name: "Factures de vente", kind: "recurring", sortOrder: 3 },
  { code: "banque", name: "Relevés bancaires", kind: "recurring", sortOrder: 4 },
  { code: "caisse", name: "Pièces de caisse", kind: "recurring", sortOrder: 5 },
  { code: "paie", name: "Paie et CNSS", kind: "social", sortOrder: 6 },
  { code: "fiscal", name: "Déclarations et accusés", kind: "fiscal", sortOrder: 7 },
  { code: "juridique", name: "Juridique et statutaire", kind: "legal", sortOrder: 8 },
  { code: "honoraires", name: "Honoraires du cabinet", kind: "fees", sortOrder: 9 },
];

/** Règles système. Voir docs/recherche/01-verification-regles.md pour les sources. */
const RULES = [
  {
    code: "TVA-M",
    label: "TVA mensuelle",
    frequency: "monthly",
    dateFormula: { kind: "end_of_next_month" },
    appliesTo: { vatRegime: ["monthly"] },
    portal: "simpl",
    proofLabel: "Accusé SIMPL-TVA",
    penaltyFormula: { kind: "cgi_208", vatOrWithholding: true },
    legalRef: "CGI art. 108 et 110",
    verificationStatus: "verified",
  },
  {
    code: "TVA-T",
    label: "TVA trimestrielle",
    frequency: "quarterly",
    dateFormula: { kind: "end_of_first_month_of_next_quarter" },
    appliesTo: { vatRegime: ["quarterly"] },
    portal: "simpl",
    proofLabel: "Accusé SIMPL-TVA",
    penaltyFormula: { kind: "cgi_208", vatOrWithholding: true },
    legalRef: "CGI art. 108 et 111",
    verificationStatus: "verified",
  },
  {
    code: "IS-ACOMPTE",
    label: "Acompte provisionnel d'IS",
    frequency: "quarterly",
    dateFormula: { kind: "end_of_quarter_after_fy_start" },
    appliesTo: { taxRegime: ["is"] },
    portal: "simpl",
    proofLabel: "Accusé SIMPL-IS",
    penaltyFormula: { kind: "cgi_208" },
    legalRef: "CGI art. 170",
    verificationStatus: "verified",
  },
  {
    code: "IS-LIASSE",
    label: "Liasse fiscale et reliquat d'IS",
    frequency: "yearly",
    dateFormula: { kind: "months_after_fy_end", months: 3 },
    appliesTo: { taxRegime: ["is"] },
    portal: "simpl",
    proofLabel: "Accusé SIMPL-IS",
    penaltyFormula: { kind: "cgi_184" },
    legalRef: "CGI art. 20 et 170-IV",
    verificationStatus: "verified",
  },
  {
    code: "IS-CM",
    label: "Cotisation minimale (IS)",
    frequency: "yearly",
    dateFormula: { kind: "end_of_nth_month_after_fy_start", months: 3 },
    appliesTo: { taxRegime: ["is"] },
    portal: "simpl",
    penaltyFormula: { kind: "cgi_208" },
    legalRef: "CGI art. 144 et 170",
    verificationStatus: "verified",
  },
  {
    code: "CNSS",
    label: "Déclaration et paiement CNSS",
    frequency: "monthly",
    dateFormula: { kind: "day_of_next_month", day: 10 },
    appliesTo: { isEmployer: true },
    portal: "damancom",
    proofLabel: "Reçu DAMANCOM",
    penaltyFormula: { kind: "cnss" },
    legalRef: "Dahir 1-72-184 ; règlement CNSS",
    verificationStatus: "to_confirm",
  },
  {
    code: "IR-SAL",
    label: "IR retenu sur salaires",
    frequency: "monthly",
    dateFormula: { kind: "end_of_next_month" },
    appliesTo: { isEmployer: true },
    portal: "simpl",
    penaltyFormula: { kind: "cgi_208", vatOrWithholding: true },
    legalRef: "CGI art. 174",
    verificationStatus: "verified",
  },
  {
    code: "ETAT-9421",
    label: "Déclaration des traitements et salaires",
    frequency: "yearly",
    dateFormula: { kind: "fixed", month: 3, day: 1, before: true },
    appliesTo: { isEmployer: true },
    portal: "simpl",
    penaltyFormula: { kind: "cgi_184" },
    legalRef: "CGI art. 79",
    verificationStatus: "verified",
  },
  {
    code: "IR-PRO",
    label: "Déclaration annuelle du revenu global (professionnels)",
    frequency: "yearly",
    dateFormula: { kind: "fixed", month: 5, day: 1, before: true },
    appliesTo: { taxRegime: ["rnr", "rns"] },
    portal: "simpl",
    penaltyFormula: { kind: "cgi_184" },
    legalRef: "CGI art. 82",
    verificationStatus: "verified",
  },
  {
    code: "IR-CM",
    label: "Cotisation minimale (IR professionnel)",
    frequency: "yearly",
    dateFormula: { kind: "fixed", month: 2, day: 1, before: true },
    appliesTo: { taxRegime: ["rnr", "rns"] },
    portal: "simpl",
    penaltyFormula: { kind: "cgi_208" },
    legalRef: "CGI art. 144 et 173",
    verificationStatus: "verified",
  },
  {
    code: "IR-AUTRE",
    label: "Déclaration annuelle du revenu global (revenus non professionnels)",
    frequency: "yearly",
    dateFormula: { kind: "fixed", month: 3, day: 1, before: true },
    appliesTo: { subtype: ["particulier"] },
    portal: "simpl",
    penaltyFormula: { kind: "cgi_184" },
    legalRef: "CGI art. 82",
    verificationStatus: "verified",
  },
  {
    code: "CPU",
    label: "Déclaration et paiement de la CPU",
    frequency: "yearly",
    dateFormula: { kind: "fixed", month: 4, day: 1, before: true },
    appliesTo: { taxRegime: ["cpu"] },
    portal: "simpl",
    penaltyFormula: { kind: "cgi_184" },
    legalRef: "CGI art. 82 quater et 173",
    verificationStatus: "verified",
  },
  {
    code: "AE-CA",
    label: "Déclaration trimestrielle du chiffre d'affaires (auto-entrepreneur)",
    frequency: "quarterly",
    dateFormula: { kind: "end_of_first_month_of_next_quarter" },
    appliesTo: { taxRegime: ["auto_entrepreneur"] },
    portal: "rn_ae",
    penaltyFormula: { kind: "cgi_184", minimum: 10000 },
    legalRef: "CGI art. 82 bis",
    verificationStatus: "verified",
  },
  {
    code: "TP-ELEM",
    label: "Déclaration des éléments imposables (taxe professionnelle)",
    frequency: "yearly",
    dateFormula: { kind: "fixed", month: 1, day: 31 },
    appliesTo: {},
    portal: "commune",
    penaltyFormula: { kind: "flat", rate: 0.15, minimum: 50000 },
    legalRef: "Loi 47-06 art. 13 et 134",
    verificationStatus: "verified",
  },
  {
    code: "AGO",
    label: "Assemblée générale d'approbation des comptes",
    frequency: "yearly",
    dateFormula: { kind: "months_after_fy_end", months: 6 },
    appliesTo: { subtype: ["sarl", "sarl_au", "sa", "sas"] },
    proofLabel: "PV d'assemblée",
    legalRef: "Loi 5-96 art. 70",
    verificationStatus: "verified",
  },
];

async function main() {
  for (const plan of PLANS) {
    const { features, ...rest } = plan;
    await db.plan.upsert({
      where: { code: plan.code },
      update: { ...rest, features: JSON.stringify(features) },
      create: { ...rest, features: JSON.stringify(features) },
    });
  }
  console.log(`Plans : ${PLANS.length}`);

  for (const category of CATEGORIES) {
    const existing = await db.documentCategory.findFirst({
      where: { cabinetId: null, code: category.code },
    });
    if (existing) {
      await db.documentCategory.update({ where: { id: existing.id }, data: category });
    } else {
      await db.documentCategory.create({ data: { ...category, cabinetId: null } });
    }
  }
  console.log(`Catégories de documents : ${CATEGORIES.length}`);

  for (const rule of RULES) {
    const data = {
      cabinetId: null,
      code: rule.code,
      label: rule.label,
      frequency: rule.frequency,
      dateFormula: JSON.stringify(rule.dateFormula),
      appliesTo: JSON.stringify(rule.appliesTo),
      portal: rule.portal ?? null,
      proofLabel: rule.proofLabel ?? null,
      penaltyFormula: rule.penaltyFormula ? JSON.stringify(rule.penaltyFormula) : null,
      legalRef: rule.legalRef,
      lawVersion: "2026",
      verificationStatus: rule.verificationStatus,
    };
    const existing = await db.deadlineRule.findFirst({
      where: { cabinetId: null, code: rule.code, lawVersion: "2026" },
    });
    if (existing) {
      await db.deadlineRule.update({ where: { id: existing.id }, data });
    } else {
      await db.deadlineRule.create({ data });
    }
  }
  console.log(`Règles d'échéances système : ${RULES.length}`);

  if (process.env.SEED_DEMO === "1") {
    await seedDemo();
  }
}

async function seedDemo() {
  const plan = await db.plan.findUniqueOrThrow({ where: { code: "free" } });
  const passwordHash = await bcrypt.hash("Demo2026!Cabinet", 12);

  const cabinet = await db.cabinet.upsert({
    where: { slug: "cabinet-demo" },
    update: {},
    create: {
      name: "Cabinet Demo",
      slug: "cabinet-demo",
      city: "Casablanca",
      ordre: "OPCA",
      ordreNum: "DEMO-0001",
      subscription: {
        create: {
          planId: plan.id,
          status: "active",
          trialEndsAt: null,
        },
      },
    },
  });

  const owner = await db.user.upsert({
    where: { email: "demo@directconseil.ma" },
    update: {},
    create: { email: "demo@directconseil.ma", name: "Gérant Démo", passwordHash, locale: "fr" },
  });

  await db.membership.upsert({
    where: { userId_cabinetId: { userId: owner.id, cabinetId: cabinet.id } },
    update: {},
    create: { userId: owner.id, cabinetId: cabinet.id, role: "owner" },
  });

  const existingClients = await db.client.count({ where: { cabinetId: cabinet.id } });
  if (existingClients === 0) {
    await db.client.createMany({
      data: [
        {
          cabinetId: cabinet.id,
          kind: "company",
          subtype: "sarl_au",
          legalName: "Benali Trading SARL AU",
          ice: "002345678000041",
          if: "51234567",
          rc: "512344",
          rcCourt: "Casablanca",
          city: "Casablanca",
          activity: "Commerce de gros",
          vatRegime: "quarterly",
          taxRegime: "is",
          isEmployer: true,
          takeoverDate: new Date("2026-01-01"),
          feeAmount: 120000,
          feeFrequency: "monthly",
        },
        {
          cabinetId: cabinet.id,
          kind: "individual",
          subtype: "auto_entrepreneur",
          legalName: "Hicham Ouazzani",
          city: "Rabat",
          activity: "Développement web",
          vatRegime: "exempt",
          taxRegime: "auto_entrepreneur",
          isEmployer: false,
          takeoverDate: new Date("2026-03-01"),
          feeAmount: 30000,
          feeFrequency: "monthly",
        },
        {
          cabinetId: cabinet.id,
          kind: "company",
          subtype: "association",
          legalName: "Association Nour pour l'éducation",
          city: "Fès",
          vatRegime: "exempt",
          taxRegime: "none",
          isEmployer: true,
          takeoverDate: new Date("2026-02-01"),
        },
      ],
    });
  }
  await seedDemoInvoices(cabinet.id);
  console.log("Cabinet de démonstration : cabinet-demo (demo@directconseil.ma)");
}

/**
 * Honoraires de démonstration.
 *
 * Les montants et les dates de règlement sont choisis pour produire les quatre
 * situations que la note de dossier doit distinguer : gros payeur ponctuel,
 * gros payeur en retard, petit payeur ponctuel, et dossier en souffrance.
 * Sans factures, tous les dossiers resteraient « non évalué ».
 */
async function seedDemoInvoices(cabinetId: string) {
  if ((await db.clientInvoice.count({ where: { cabinetId } })) > 0) return;

  const clients = await db.client.findMany({
    where: { cabinetId },
    select: { id: true, legalName: true },
  });
  const find = (needle: string) => clients.find((c) => c.legalName.includes(needle));

  const DAY = 86400000;
  const monthsAgo = (n: number) => new Date(Date.now() - n * 30 * DAY);

  type Plan = { client?: { id: string }; amount: number; months: number[]; delay: number | null };

  const plans: Plan[] = [
    // Gros dossier, règle avant l'échéance : doit ressortir au maximum.
    { client: find("Benali"), amount: 450000, months: [9, 6, 3, 1], delay: -3 },
    // Volume comparable, mais règle systématiquement en retard.
    { client: find("Nour"), amount: 380000, months: [9, 6, 3], delay: 28 },
    // Petit dossier, toujours à l'heure.
    { client: find("Ouazzani"), amount: 30000, months: [8, 5, 2], delay: 0 },
  ];

  let sequence = 0;
  for (const plan of plans) {
    if (!plan.client) continue;
    for (const months of plan.months) {
      sequence += 1;
      const issuedAt = monthsAgo(months);
      const dueDate = new Date(issuedAt.getTime() + 30 * DAY);
      const paidAt = plan.delay === null ? null : new Date(dueDate.getTime() + plan.delay * DAY);
      await db.clientInvoice.create({
        data: {
          cabinetId,
          clientId: plan.client.id,
          reference: `DEMO-${String(sequence).padStart(4, "0")}`,
          label: "Honoraires de tenue comptable",
          amount: plan.amount,
          paidAmount: paidAt ? plan.amount : 0,
          issuedAt,
          dueDate,
          paidAt,
          status: paidAt ? "paid" : "pending",
        },
      });
    }
  }

  // Une facture échue jamais réglée, pour montrer la pénalité d'impayé.
  const impaye = find("Nour");
  if (impaye) {
    const issuedAt = monthsAgo(4);
    await db.clientInvoice.create({
      data: {
        cabinetId,
        clientId: impaye.id,
        reference: `DEMO-${String(sequence + 1).padStart(4, "0")}`,
        label: "Honoraires — assemblée générale",
        amount: 120000,
        paidAmount: 0,
        issuedAt,
        dueDate: new Date(issuedAt.getTime() + 30 * DAY),
        paidAt: null,
        status: "pending",
      },
    });
  }
}

main()
  .then(() => db.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await db.$disconnect();
    process.exit(1);
  });
