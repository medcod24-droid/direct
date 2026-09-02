import { execSync } from "node:child_process";
import { rmSync } from "node:fs";

/**
 * Base de test isolée (fichier SQLite jetable, supprimé puis recréé).
 * On supprime le fichier nous-mêmes plutôt que d'utiliser `--force-reset` :
 * aucune commande destructive n'est exécutée contre une base existante.
 */
export default function setup() {
  const env = { ...process.env, DATABASE_URL: "file:./test.db" };
  for (const file of ["prisma/test.db", "prisma/test.db-journal"]) {
    rmSync(file, { force: true });
  }
  execSync("npx prisma db push --skip-generate", { stdio: "pipe", env });
  execSync("npx tsx prisma/seed.ts", { stdio: "pipe", env });
}
