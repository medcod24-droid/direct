# Architecture

## Audit de départ

Le dépôt ne contenait aucun code applicatif au moment de la reprise : ni `package.json`, ni
dépôt Git, ni source d'aucun langage. Seul `docs/` existait (plan de lancement et dossier de
recherche produits précédemment). Il n'y avait donc rien à préserver ni à refactorer : la
plateforme a été construite depuis une base vide, en reprenant les règles métier documentées
dans `docs/`.

## Couches

```
Interface (src/app)          pages serveur, formulaires, actions serveur
        ↓ requirePermission()
Autorisation (src/lib/authz) rôles, permissions, portée par dossier
        ↓ ctx.db (déjà filtré)
Services (src/server)        logique métier, validation, audit, notifications
        ↓
Accès données (src/lib/db)   client Prisma étendu, isolation multi-tenant
        ↓
PostgreSQL / SQLite + stockage privé de fichiers
```

Règles tenues dans tout le code :

- aucune logique métier dans un composant d'interface ;
- aucun service ne reçoit un client Prisma non filtré ;
- toute donnée entrante passe par un schéma Zod (`src/lib/validation/schemas.ts`) ;
- aucune date légale, aucun prix et aucune limite de plan n'est codé en dur dans le code
  applicatif : ce sont des lignes de base modifiables.

## Modèle de données

**Plateforme** — `Plan`, `Cabinet`, `Subscription`, `User`, `Membership`, `Session`,
`Invitation`.

Un `User` peut appartenir à plusieurs cabinets ; le `Membership` porte le rôle, la portée
(`restrictedToAssigned`) et, pour un accès client, le dossier rattaché (`clientId`).

**Cabinet (multi-tenant)** — `Client`, `Contact`, `ClientAssignment`, `Document`,
`DocumentCategory`, `DocumentRequest`, `Task`, `TaskComment`, `DeadlineRule`, `Deadline`,
`Message`, `Notification`, `ClientInvoice`, `Activity`, `AuditLog`.

Chaque table de cabinet porte `cabinetId` et est indexée dessus, plus des index composites sur
les accès réels (`cabinetId + status + dueDate`, `cabinetId + clientId`). `DocumentCategory` et
`DeadlineRule` acceptent `cabinetId = null` : ce sont les lignes système fournies par la
plateforme, lisibles par tous, modifiables par personne.

Trois champs viennent d'une relecture par un expert-comptable et évitent qu'un tableau de bord
soit rouge à tort :

- `Client.takeoverDate` — aucune obligation n'est générée avant la prise en charge du dossier ;
- `Deadline.managedBy` — cabinet, client ou tiers ; ce qui n'est pas géré par le cabinet ne
  compte pas dans ses retards ;
- `Client.activityState` — un dossier dormant, en liquidation ou radié ne génère plus
  d'obligations récurrentes.

Tous les montants sont des entiers en **centimes de dirham**. Aucun flottant pour l'argent.

## Moteur d'échéances

`src/lib/deadlines/engine.ts` est un module pur, sans base de données, couvert par 75 tests.

Une règle (`DeadlineRule`) porte : conditions d'application, fréquence, formule de date,
portail, preuve attendue, formule de pénalité, référence légale, version de loi de finances et
**statut de vérification** (`verified` / `to_confirm`), affiché dans les paramètres.

Deux pièges du droit marocain sont traités explicitement :

- « avant le 1er mars » signifie le dernier jour utile avant, soit le 28 ou 29 février, alors
  que « avant l'expiration du mois » signifie le dernier jour du mois ;
- l'exercice social n'est pas toujours l'année civile : les acomptes d'IS se calculent à partir
  de l'ouverture de l'exercice (CGI art. 170), pas du 1er janvier.

Le report au premier jour ouvrable (CGI art. 163) est appliqué avec un calendrier de jours
fériés fourni par l'administrateur. Le samedi n'étant pas « chômé légal » au sens strict, son
traitement est un paramètre explicite, jamais une hypothèse silencieuse.

## Notifications

`src/lib/notifications/service.ts` expose une seule fonction `notify()` et une interface
`Channel`. Trois canaux : interne (centre de notifications), e-mail, et un emplacement WhatsApp
volontairement désactivé — les messages transiteraient par des serveurs hors du Maroc, ce qui
constitue un transfert de données à notifier. L'échec d'un canal n'interrompt jamais l'action
métier.

## Abonnements et limites

`Plan` porte les limites (`maxClients`, `maxUsers`, `maxStorageMb`, `maxMonthlyUploads`, `null`
= illimité) et la liste des fonctionnalités. `assertWithinLimit()` est appelé côté serveur avant
chaque création : aucune limite n'est envoyée au navigateur ni acceptée depuis lui. Le
branchement d'un prestataire de paiement (CMI, YouCan Pay, Stripe via une entité étrangère) se
fait sur `Subscription.externalRef` sans toucher au reste.

## Performance

Les agrégats du tableau de bord et la santé des dossiers utilisent `groupBy` et `count` : le
nombre de requêtes ne dépend pas du nombre de clients. Les listes sont paginées côté base. Les
documents sont diffusés en flux, jamais chargés entièrement en mémoire.

À prévoir avant la montée en charge : file d'exécution différée (rappels, e-mails, OCR) et
index `pg_trgm` pour la recherche.
