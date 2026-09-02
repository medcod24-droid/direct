# Direct Conseil

Plateforme de gestion de cabinet pour les comptables agréés (OPCA) et les experts-comptables
(OEC) au Maroc. Un cabinet y centralise ses dossiers clients, ses documents, ses échéances
fiscales et sociales, ses demandes de pièces, ses tâches et ses honoraires.

Ce n'est **pas** un logiciel comptable : Direct Conseil se pose au-dessus de Sage, KHABIR, EBP ou Odoo
et ne produit aucune écriture. Positionnement, marché et règles métier : `docs/plan-direct-conseil.html`.

## Démarrage

```bash
npm install
cp .env.example .env      # puis renseigner APP_SECRET (openssl rand -base64 48)
npm run db:push           # crée le schéma
npm run db:seed           # plans, catégories, règles d'échéances système
SEED_DEMO=1 npm run db:seed   # ajoute un cabinet de démonstration
npm run dev
```

Compte de démonstration : `demo@directconseil.ma` / `Demo2026!Cabinet`.

## Scripts

| Commande | Rôle |
|---|---|
| `npm run dev` | Serveur de développement (port 3000) |
| `npm run build` | Build de production (génère le client Prisma) |
| `npm run typecheck` | TypeScript strict, sans émission |
| `npm test` | Suite complète (unitaires, sécurité, intégration) |
| `npm run db:push` | Applique le schéma Prisma à la base |
| `npm run db:seed` | Données de référence |

## Base de données

- **Développement et tests** : SQLite (`prisma/dev.db`, `prisma/test.db`). Aucun service à
  installer.
- **Production** : PostgreSQL. Remplacer dans `prisma/schema.prisma` :
  ```prisma
  datasource db {
    provider = "postgresql"
    url      = env("DATABASE_URL")
  }
  ```
  puis `npx prisma migrate deploy`. Le schéma n'utilise aucune fonctionnalité propre à SQLite ;
  les valeurs d'énumération sont des chaînes contraintes côté application
  (`src/lib/domain/enums.ts`), ce qui rend la bascule sans douleur.

Deux limites connues de SQLite en développement : la recherche est sensible à la casse
(`mode: "insensitive"` n'existe pas) et il n'y a pas d'index trigram. En production, prévoir
un index `pg_trgm` sur `Client.legalName`, `Client.ice` et `Document.filename`.

## Structure

```
prisma/          schéma et données de référence (règles d'échéances marocaines)
src/lib/         socle : db, auth, authz, storage, deadlines, billing, i18n, format
src/server/      services métier (aucune logique dans les pages)
src/app/         routes Next.js : (auth), (app) espace cabinet, (portal) espace client, api
src/components/  design system
public/          fichiers servis tels quels (logo)
brand/           logo source en pleine résolution
tests/           unit, security, integration
var/storage/     documents (hors racine web, jamais servi statiquement)
docs/            plan de lancement et dossier de recherche
```

Chaîne d'appel : page ou action serveur → `requirePermission()` → service → `ctx.db`
(client Prisma déjà restreint au cabinet) → base. Voir `ARCHITECTURE.md`.

## Sécurité

Isolation multi-tenant, rôles, sécurité documentaire, journal d'audit et risques connus :
`SECURITY.md`. Les scénarios d'attaque exigés (accès inter-cabinets, portail client, URL
directe, manipulation d'identifiants, contournement des limites de plan) sont couverts par
`tests/security/`.

## Déploiement

Prérequis : Node 20+, PostgreSQL 15+, un stockage de fichiers persistant et chiffré,
HTTPS obligatoire.

1. Variables d'environnement (voir `.env.example`) : `DATABASE_URL`, `APP_SECRET`,
   `STORAGE_ROOT`, `APP_URL`, `EMAIL_PROVIDER`, `NODE_ENV=production`.
2. `npm ci && npm run build && npx prisma migrate deploy && npm run db:seed`
3. Sauvegardes : base chiffrée quotidienne + réplication du stockage documentaire, avec test
   de restauration mensuel. Le stockage objet seul n'est pas une sauvegarde.
4. Hébergement au Maroc recommandé : héberger à l'étranger constitue un transfert de données
   au sens des articles 43-44 de la loi 09-08 et impose une formalité par cabinet client.
5. Sonde de santé : `GET /api/health`.

## Ce que le produit ne fait pas

Pas de production comptable, pas de synchronisation bancaire (l'open banking n'est pas
réglementé au Maroc), pas de télédéclaration automatique (SIMPL et DAMANCOM n'exposent aucune
API publique), pas de paie, pas de stockage de mots de passe de portails, pas de dates de
facturation électronique codées en dur tant que le décret n'est pas publié.
