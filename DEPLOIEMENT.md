# Mise en ligne

Procédure pour publier Direct Conseil et donner un lien à un cabinet.

## Deux contraintes qui décident de l'hébergeur

**Les documents sont écrits sur le disque.** `src/lib/storage` enregistre les
fichiers sous `STORAGE_ROOT`. Un hébergeur *serverless* (Vercel, Netlify) donne
un système de fichiers éphémère : les pièces déposées disparaîtraient au
redéploiement, sans erreur visible. Il faut donc **un serveur avec un disque
persistant**, ou modifier la couche de stockage pour viser un stockage objet.

**Les données sont personnelles.** Héberger hors du Maroc constitue un transfert
au sens des articles 43-44 de la loi 09-08, à notifier à la CNDP par chaque
cabinet client. Pour un test avec des données fictives, l'enjeu est faible ;
dès qu'un cabinet saisit de vrais dossiers, l'hébergement au Maroc évite cette
formalité.

## Ce qu'il faut

- Node 20 ou plus
- PostgreSQL 15 ou plus
- Un disque persistant pour les documents
- HTTPS (obligatoire : le cookie de session est `Secure` en production)

## 1. Passer la base en PostgreSQL

Le schéma n'utilise aucune particularité SQLite. Dans `prisma/schema.prisma` :

```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
```

Prisma n'accepte pas de variable pour `provider` : cette ligne se modifie à la
main.

## 2. Variables d'environnement

```bash
DATABASE_URL="postgresql://utilisateur:motdepasse@hote:5432/directconseil"
APP_SECRET="<openssl rand -base64 48>"
STORAGE_ROOT="/var/lib/direct-conseil/storage"
APP_URL="https://votre-domaine.ma"
EMAIL_PROVIDER="console"
NODE_ENV="production"
```

`APP_SECRET` sert au hachage des jetons de session et d'invitation : le changer
déconnecte tout le monde et invalide les invitations en cours. Il ne doit jamais
être versionné.

`EMAIL_PROVIDER=console` n'envoie aucun courriel : les liens d'invitation
s'affichent alors dans l'application pour être transmis à la main. C'est
suffisant pour un test.

## 3. Installer et démarrer

```bash
npm ci
npm run build
npx prisma migrate deploy
npm run db:seed
npm run start
```

`db:seed` charge les plans, les catégories de documents et les 15 règles
d'échéances marocaines. Sans lui, aucune échéance ne peut être générée.

Le premier compte se crée depuis `/signup` : il n'y a pas de compte
administrateur par défaut.

## 4. Vérifier

```bash
curl https://votre-domaine.ma/api/health
```

Réponse attendue : `{"status":"ok","database":"ok"}`.

Puis, dans un navigateur : créer un cabinet depuis `/signup`, créer un dossier,
générer les échéances de l'année, déposer un document, se déconnecter et se
reconnecter. Si le document déposé est encore téléchargeable après un
redémarrage du serveur, le stockage est bien persistant.

## 5. Sauvegardes

Une base sauvegardée sans les documents, ou l'inverse, ne permet pas de
restaurer : les deux vont ensemble.

- `pg_dump` chiffré, quotidien
- copie du contenu de `STORAGE_ROOT`
- **test de restauration mensuel** — une sauvegarde jamais restaurée n'est pas
  une sauvegarde

La réplication du stockage objet ne remplace pas une sauvegarde : elle réplique
aussi les suppressions.

## Remettre la plateforme à zéro

```bash
npm run db:reset
```

Efface cabinets, comptes, dossiers, documents et journaux, et vide le stockage.
Conserve les plans, catégories et règles d'échéances. À utiliser entre deux
phases de test, jamais sur une installation en service.

## Avant d'ouvrir à de vrais dossiers

Les points listés dans `SECURITY.md` restent ouverts, notamment : la double
authentification non branchée, CSP encore en `'unsafe-inline'`, pas de limitation de débit hors
verrouillage de compte, pas d'analyse antivirus des dépôts, et aucune revue de
sécurité externe. Ils sont acceptables pour un test avec des données fictives,
pas pour des dossiers réels.
