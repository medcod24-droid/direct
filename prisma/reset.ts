/**
 * Vide les données d'exploitation en gardant les données de référence.
 *
 * Sont effacés : cabinets, comptes, dossiers, documents, échéances, honoraires
 * et journaux. Sont conservés : plans, catégories de documents et règles
 * d'échéances système — ce que la plateforme fournit et qui n'appartient à
 * personne.
 *
 * Les fichiers déposés sont supprimés du stockage : les garder sans les lignes
 * qui les référencent laisserait des documents orphelins, illisibles et non
 * effaçables depuis l'application.
 */
import { PrismaClient } from "@prisma/client";
import { rm } from "node:fs/promises";
import path from "node:path";

const db = new PrismaClient();

async function main() {
  const cabinets = await db.cabinet.count();
  const users = await db.user.count();

  // Les suppressions en cascade partent du cabinet ; les comptes ne dépendent
  // d'aucun cabinet et se suppriment séparément.
  await db.cabinet.deleteMany({});
  await db.session.deleteMany({});
  await db.user.deleteMany({});
  await db.auditLog.deleteMany({});

  const root = process.env.STORAGE_ROOT ?? "./var/storage";
  const resolved = path.resolve(root);
  await rm(resolved, { recursive: true, force: true }).catch(() => undefined);

  const plans = await db.plan.count();
  const categories = await db.documentCategory.count();
  const rules = await db.deadlineRule.count();

  console.log(`Effacé  : ${cabinets} cabinet(s), ${users} compte(s), et le stockage ${resolved}`);
  console.log(`Conservé : ${plans} plans, ${categories} catégories, ${rules} règles d'échéances`);
  console.log("La plateforme est vide : le premier compte se crée depuis /signup.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
