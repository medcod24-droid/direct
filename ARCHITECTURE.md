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

### Fiche client : deux formes

`Client.kind` sépare la personne physique de la personne morale, et la fiche ne montre que les
pièces qui existent pour le type choisi — CIN, délégation, enseigne commerciale et
immatriculation CNSS personnelle d'un côté ; certificat négatif, domiciliation et associés de
l'autre. `subtypesFor(kind)` (dans `lib/domain/enums.ts`) restreint les formes juridiques
proposées, et la même règle est revérifiée côté serveur : l'écran filtre, il ne protège pas.

Plusieurs champs sont des **listes**, sérialisées en JSON comme `tags`, faute d'un type tableau
en SQLite : `declaredActivities`, `registrations`, `partners` et `employees`.
`Client.activities` est déjà la relation vers le journal, d'où le nom `declaredActivities`.

**Les immatriculations sont un arbre**, et cette forme vient du droit, pas de l'écran :

- un commerçant n'a qu'une immatriculation **principale** (code de commerce, art. 39), mais il
  en prend une **secondaire** dans chaque ressort où il exploite (art. 38 et 41) — d'où une
  liste de registres, chacun avec son tribunal ;
- un établissement ouvert dans le ressort du **même** tribunal reste rattaché à
  l'immatriculation existante — d'où les succursales à l'intérieur d'un registre ;
- la taxe professionnelle est établie au lieu de **chaque établissement** et son numéro
  d'identification doit y être affiché (loi 47-06, art. 8 et 14) — d'où des numéros de taxe par
  établissement, **y compris le principal**, sans quoi le dossier le plus courant, un local
  unique sans succursale, n'aurait nulle part où inscrire le sien.

`rc`, `rcCourt`, `taxProfNo`, `taxProfNos` et `branches` sont des **projections plates** de cet
arbre, reconstruites à chaque écriture : la recherche et les listes n'ont ainsi pas à le
parcourir, et un dossier se retrouve par le numéro d'une succursale ou d'une taxe. De même,
`activity` garde la première activité et `employeeCount` est déduit du nombre de salariés dès
que le cabinet les nomme.

Deux cas propres à la personne physique élargissent la fiche :

- la forme **« Autre »** ouvre un champ libre (`subtypeOther`), la liste fermée ne couvrant pas
  tout ; c'est ce nom qui s'affiche partout, un dossier étiqueté « Autre » dans la liste ne
  disant rien de plus que rien (`clientFormLabel`) ;
- la forme **« Particulier »** ouvre les **articles d'imposition**, un par bien imposé
  (`articles`). L'usage — principale, secondaire, locatif — n'est pas une étiquette : la taxe
  d'habitation n'abat la valeur locative que pour l'habitation principale (loi 47-06, art. 20),
  un bien donné en location n'y est pas soumis mais produit des revenus fonciers imposables à
  l'IR, et le secondaire ne bénéficie d'aucun abattement.

### Justificatifs rattachés aux champs

`Document.fieldKey` désigne le champ de la fiche qu'une pièce justifie :
`« cin »`, `« ice »`, ou `« rc:<id> »` pour une ligne d'une liste. Un seul
document actif par champ — le dépôt suivant remplace le précédent, la fiche
montrant la pièce en cours et non un historique.

Les lignes des listes portent donc un **identifiant stable**, émis par le
navigateur puis réémis par le serveur s'il manque ou se répète. Un indice de
position ne conviendrait pas : retirer une succursale renumérote celles qui
suivent, et le scan du registre se retrouverait accroché au mauvais
établissement. Un justificatif dont la ligne a été supprimée n'est pas perdu : il
reste une pièce ordinaire du dossier, simplement plus affichée en face d'un
champ.

Le dépôt appelle l'action serveur directement, sans `<form>` : ces contrôles
vivent à l'intérieur du formulaire de la fiche, et un formulaire imbriqué est
interdit en HTML — le navigateur l'ignore sans rien signaler. L'action ne
revalide aucun chemin, car rafraîchir la route en cours remonterait le formulaire
et réémettrait les identifiants des lignes non encore enregistrées.

Les CIN des associés et des salariés suivent la même règle que celle du gérant : elles ne sont
enregistrées qu'en mode CNDP « autorisation » (loi 09-08, art. 12-1-e). Le filtrage est appliqué
dans `server/services/clients.ts`, à un seul endroit, et non dans le formulaire — une liste non
filtrée serait devenue la voie par laquelle des numéros entrent malgré le mode « déclaration ».

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
