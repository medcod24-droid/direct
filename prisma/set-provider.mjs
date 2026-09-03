/**
 * Bascule le fournisseur de base du schéma Prisma.
 *
 * Prisma n'accepte pas de variable pour `provider` : la valeur est statique dans
 * le schéma. Le dépôt reste en `sqlite`, ce qui garde le développement local et
 * les tests utilisables sans serveur de base. La bascule vers `postgresql` se
 * fait au moment du build sur l'hébergeur, où la copie du dépôt est jetable.
 *
 *   node prisma/set-provider.mjs postgresql
 */
import { readFile, writeFile } from "node:fs/promises";

const CONNUS = ["sqlite", "postgresql", "mysql"];
const cible = process.argv[2];

if (!CONNUS.includes(cible)) {
  console.error(`Fournisseur attendu parmi : ${CONNUS.join(", ")}. Reçu : ${cible ?? "(rien)"}`);
  process.exit(1);
}

const chemin = new URL("./schema.prisma", import.meta.url);
const source = await readFile(chemin, "utf8");

const motif = /(datasource\s+db\s*\{[^}]*?provider\s*=\s*")([a-z]+)(")/s;
const trouve = source.match(motif);

if (!trouve) {
  console.error("Bloc `datasource db` introuvable dans schema.prisma.");
  process.exit(1);
}

if (trouve[2] === cible) {
  console.log(`Fournisseur déjà « ${cible} », rien à faire.`);
  process.exit(0);
}

await writeFile(chemin, source.replace(motif, `$1${cible}$3`));
console.log(`Fournisseur passé de « ${trouve[2]} » à « ${cible} ».`);
