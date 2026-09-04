/**
 * Dossiers de démonstration, pour montrer la plateforme à un cabinet.
 *
 * Chaque dossier est choisi pour déclencher une combinaison d'obligations
 * différente : c'est le moteur d'échéances qui décide, à partir de la forme
 * juridique, du régime fiscal, du régime de TVA et de la qualité d'employeur.
 * On voit donc en une page pourquoi deux dossiers n'ont pas le même calendrier.
 *
 * Le script ne touche qu'un seul cabinet, désigné par l'adresse de son
 * propriétaire, et ne s'exécute pas deux fois sur les mêmes dossiers.
 *
 *   OWNER_EMAIL=... npm run db:demo
 */
import { PrismaClient } from "@prisma/client";
import { can } from "../src/lib/authz/permissions";
import { tenantDb } from "../src/lib/db/tenant";
import { generateForYear } from "../src/server/services/deadlines";
import type { AuthContext } from "../src/lib/authz/guard";

const db = new PrismaClient();

const OWNER = process.env.OWNER_EMAIL ?? "med.cod24@gmail.com";
const YEAR = Number(process.env.DEMO_YEAR ?? new Date().getUTCFullYear());
const DAY = 86400000;

type Demo = {
  legalName: string;
  tradeName?: string;
  kind: "company" | "individual";
  subtype: string;
  taxRegime: string;
  vatRegime: string;
  isEmployer: boolean;
  city: string;
  activity: string;
  ice?: string;
  if?: string;
  rc?: string;
  fiscalYearEndMonth?: number;
  fiscalYearEndDay?: number;
  takeoverMonthsAgo: number;
  activityState?: string;
  priority?: string;
  feeAmount?: number;
  feeFrequency?: string;
  /** Commentaire visible dans les notes, pour expliquer l'intérêt du cas. */
  note: string;
};

const DOSSIERS: Demo[] = [
  {
    legalName: "Atlas Distribution SARL",
    tradeName: "Atlas Distrib",
    kind: "company",
    subtype: "sarl",
    taxRegime: "is",
    vatRegime: "monthly",
    isEmployer: true,
    city: "Casablanca",
    activity: "Négoce de matériel électrique",
    ice: "001234567000045",
    if: "40218765",
    rc: "345678",
    takeoverMonthsAgo: 18,
    priority: "high",
    feeAmount: 350000,
    feeFrequency: "monthly",
    note: "Cas le plus chargé : IS, TVA mensuelle et salariés. Déclenche neuf obligations différentes.",
  },
  {
    legalName: "Chorouk Consulting SARL AU",
    kind: "company",
    subtype: "sarl_au",
    taxRegime: "is",
    vatRegime: "quarterly",
    isEmployer: false,
    city: "Rabat",
    activity: "Conseil en organisation",
    ice: "002345678000041",
    if: "51234567",
    rc: "128934",
    takeoverMonthsAgo: 10,
    feeAmount: 180000,
    feeFrequency: "monthly",
    note: "Associé unique, sans salarié : ni CNSS ni IR sur salaires, et TVA trimestrielle.",
  },
  {
    legalName: "Souss Agro SA",
    kind: "company",
    subtype: "sa",
    taxRegime: "is",
    vatRegime: "monthly",
    isEmployer: true,
    city: "Agadir",
    activity: "Conditionnement d'agrumes",
    ice: "003456789000012",
    if: "60112233",
    rc: "9876",
    // Exercice social clos au 30 juin : les acomptes d'IS ne suivent pas
    // l'année civile (CGI art. 170).
    fiscalYearEndMonth: 6,
    fiscalYearEndDay: 30,
    takeoverMonthsAgo: 24,
    priority: "high",
    feeAmount: 800000,
    feeFrequency: "monthly",
    note: "Exercice décalé au 30/06 : montre que les acomptes d'IS partent de l'ouverture de l'exercice, pas du 1er janvier.",
  },
  {
    legalName: "Yassine Benali",
    kind: "individual",
    subtype: "auto_entrepreneur",
    taxRegime: "auto_entrepreneur",
    vatRegime: "exempt",
    isEmployer: false,
    city: "Marrakech",
    activity: "Développement web",
    takeoverMonthsAgo: 6,
    feeAmount: 30000,
    feeFrequency: "monthly",
    note: "Auto-entrepreneur : déclaration trimestrielle du chiffre d'affaires, hors champ de la TVA.",
  },
  {
    legalName: "Association Al Amal pour l'enfance",
    kind: "company",
    subtype: "association",
    taxRegime: "none",
    vatRegime: "exempt",
    isEmployer: true,
    city: "Fès",
    activity: "Action sociale",
    takeoverMonthsAgo: 14,
    feeAmount: 120000,
    feeFrequency: "quarterly",
    note: "Association employeuse : pas d'IS, mais CNSS, IR sur salaires et déclaration des traitements.",
  },
  {
    legalName: "Café Riad Zitoun",
    kind: "individual",
    subtype: "particulier",
    taxRegime: "cpu",
    vatRegime: "exempt",
    isEmployer: false,
    city: "Marrakech",
    activity: "Café-restaurant",
    takeoverMonthsAgo: 8,
    feeAmount: 45000,
    feeFrequency: "monthly",
    note: "Contribution professionnelle unique : une seule déclaration annuelle.",
  },
  {
    legalName: "Kamal Ouazzani",
    kind: "individual",
    subtype: "rnr",
    taxRegime: "rnr",
    vatRegime: "quarterly",
    isEmployer: false,
    city: "Tanger",
    activity: "Import-export de textile",
    ice: "004567890000078",
    if: "70334455",
    takeoverMonthsAgo: 20,
    feeAmount: 200000,
    feeFrequency: "monthly",
    note: "Personne physique au résultat net réel : IR professionnel et cotisation minimale, pas d'IS.",
  },
  {
    legalName: "Coopérative Tissage Zayane",
    kind: "company",
    subtype: "cooperative",
    taxRegime: "is",
    vatRegime: "quarterly",
    isEmployer: false,
    city: "Khénifra",
    activity: "Tissage artisanal",
    ice: "005678901000033",
    takeoverMonthsAgo: 4,
    // Dossier mis en sommeil : aucune obligation récurrente n'est générée.
    activityState: "dormant",
    feeAmount: 60000,
    feeFrequency: "quarterly",
    note: "Dossier en sommeil : la plateforme cesse de générer des obligations, le tableau de bord ne vire pas au rouge à tort.",
  },
];

async function main() {
  const owner = await db.user.findUnique({ where: { email: OWNER } });
  if (!owner) throw new Error(`Aucun compte pour ${OWNER}.`);

  const membership = await db.membership.findFirst({
    where: { userId: owner.id, status: "active" },
    include: { cabinet: true },
  });
  if (!membership) throw new Error(`${OWNER} n'appartient à aucun cabinet actif.`);

  const cabinetId = membership.cabinetId;
  console.log(`Cabinet visé : ${membership.cabinet.name}\n`);

  const now = new Date();
  let crees = 0;

  for (const d of DOSSIERS) {
    const existe = await db.client.findFirst({
      where: { cabinetId, legalName: d.legalName },
      select: { id: true },
    });
    if (existe) {
      console.log(`  = ${d.legalName} (déjà présent)`);
      continue;
    }

    await db.client.create({
      data: {
        cabinetId,
        kind: d.kind,
        subtype: d.subtype,
        legalName: d.legalName,
        tradeName: d.tradeName ?? null,
        ice: d.ice ?? null,
        if: d.if ?? null,
        rc: d.rc ?? null,
        city: d.city,
        activity: d.activity,
        taxRegime: d.taxRegime,
        vatRegime: d.vatRegime,
        isEmployer: d.isEmployer,
        fiscalYearEndMonth: d.fiscalYearEndMonth ?? 12,
        fiscalYearEndDay: d.fiscalYearEndDay ?? 31,
        takeoverDate: new Date(now.getTime() - d.takeoverMonthsAgo * 30 * DAY),
        activityState: d.activityState ?? "running",
        priority: d.priority ?? "normal",
        feeAmount: d.feeAmount ?? null,
        feeFrequency: d.feeFrequency ?? null,
        notes: d.note,
        tags: "[]",
      },
    });
    crees += 1;
    console.log(`  + ${d.legalName}`);
  }

  // --- échéances -----------------------------------------------------------
  // On passe par le service, donc par le vrai moteur : les obligations sont
  // celles que la plateforme calculerait d'elle-même, pas une liste écrite ici.
  const scope = { cabinetId, clientIds: null };
  const ctx = {
    sessionId: "demo",
    user: { id: owner.id, email: owner.email, name: owner.name, locale: "fr" },
    cabinet: {
      id: cabinetId,
      name: membership.cabinet.name,
      slug: membership.cabinet.slug,
      cndpMode: membership.cabinet.cndpMode,
    },
    membership: { id: membership.id, role: "owner", restrictedToAssigned: false, clientId: null },
    scope,
    db: tenantDb(scope),
    ip: null,
    userAgent: "demo",
    can: (permission: Parameters<typeof can>[1]) => can("owner", permission),
  } as unknown as AuthContext;

  const genere = await generateForYear(ctx, { year: YEAR });
  console.log(`\nÉchéances ${YEAR} : ${genere.created} générée(s) sur ${genere.clients} dossier(s)`);

  // --- honoraires ----------------------------------------------------------
  // Trois comportements de paiement, pour que la note en étoiles des dossiers
  // ait du sens dès la première visite.
  const dossiers = await db.client.findMany({ where: { cabinetId }, select: { id: true, legalName: true, feeAmount: true } });
  const trouve = (nom: string) => dossiers.find((c) => c.legalName.includes(nom));

  const profils: { nom: string; mois: number[]; retardJours: number | null }[] = [
    { nom: "Souss Agro", mois: [9, 6, 3, 1], retardJours: -2 },   // gros, règle en avance
    { nom: "Atlas Distribution", mois: [8, 5, 2], retardJours: 22 }, // gros, règle en retard
    { nom: "Yassine Benali", mois: [7, 4, 1], retardJours: 0 },   // petit, toujours à l'heure
  ];

  let sequence = await db.clientInvoice.count({ where: { cabinetId } });
  let factures = 0;

  for (const profil of profils) {
    const client = trouve(profil.nom);
    if (!client) continue;
    for (const mois of profil.mois) {
      sequence += 1;
      const reference = `${YEAR}-${String(sequence).padStart(4, "0")}`;
      if (await db.clientInvoice.findFirst({ where: { cabinetId, reference } })) continue;
      const issuedAt = new Date(now.getTime() - mois * 30 * DAY);
      const dueDate = new Date(issuedAt.getTime() + 30 * DAY);
      const paidAt = profil.retardJours === null ? null : new Date(dueDate.getTime() + profil.retardJours * DAY);
      const amount = client.feeAmount ?? 150000;
      await db.clientInvoice.create({
        data: {
          cabinetId,
          clientId: client.id,
          reference,
          label: "Honoraires de tenue comptable",
          amount,
          paidAmount: paidAt ? amount : 0,
          issuedAt,
          dueDate,
          paidAt,
          status: paidAt ? "paid" : "pending",
        },
      });
      factures += 1;
    }
  }

  // Une facture échue jamais réglée, pour montrer l'effet sur la note.
  const mauvaisPayeur = trouve("Atlas Distribution");
  if (mauvaisPayeur) {
    const reference = `${YEAR}-${String(sequence + 1).padStart(4, "0")}`;
    if (!(await db.clientInvoice.findFirst({ where: { cabinetId, reference } }))) {
      const issuedAt = new Date(now.getTime() - 4 * 30 * DAY);
      await db.clientInvoice.create({
        data: {
          cabinetId, clientId: mauvaisPayeur.id, reference,
          label: "Honoraires — assemblée générale",
          amount: 250000, paidAmount: 0,
          issuedAt, dueDate: new Date(issuedAt.getTime() + 30 * DAY),
          paidAt: null, status: "pending",
        },
      });
      factures += 1;
    }
  }
  console.log(`Honoraires : ${factures} facture(s) créée(s)`);

  // --- tâches --------------------------------------------------------------
  const taches = [
    { nom: "Souss Agro", titre: "Préparer l'attestation de régularité fiscale", priorite: "urgent", dans: 2 },
    { nom: "Atlas Distribution", titre: "Relancer le client pour les relevés bancaires de mars", priorite: "high", dans: 5 },
    { nom: "Association Al Amal", titre: "Vérifier l'affiliation CNSS des deux nouveaux salariés", priorite: "normal", dans: 12 },
  ];
  let creesTaches = 0;
  for (const t of taches) {
    const client = trouve(t.nom);
    if (!client) continue;
    if (await db.task.findFirst({ where: { cabinetId, title: t.titre } })) continue;
    await db.task.create({
      data: {
        cabinetId, clientId: client.id, title: t.titre,
        priority: t.priorite, status: "todo",
        dueDate: new Date(now.getTime() + t.dans * DAY),
        assigneeId: owner.id, createdById: owner.id,
      },
    });
    creesTaches += 1;
  }
  console.log(`Tâches : ${creesTaches} créée(s)`);

  await db.$disconnect();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
