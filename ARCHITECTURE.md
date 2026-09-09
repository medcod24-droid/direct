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

### Tableau de bord

Il ouvre sur trois choses, dans cet ordre : les **échéances en retard du mois en cours**, la
to-do — la sienne, puis celle de l'équipe pour qui la distribue —, et les **rendez-vous du
jour**. Les trois sections restent affichées même vides : leur disparition se lirait comme un
oubli plutôt que comme « rien à faire ».

Le retard est borné au mois **volontairement**. Un calendrier généré pour l'année affiche des
dizaines d'obligations déjà passées dès sa création : « 81 en retard » ne disait rien de ce qu'il
y a à faire, et un compteur qu'on ne peut pas ramener à zéro cesse d'être lu.

Les tâches de l'équipe s'y confirment sans quitter la page — c'est le geste le plus fréquent de
l'administration.

### Résultat du cabinet

`MonthlyResult` porte, mois par mois, ce que le cabinet gagne et ce qu'il dépense. C'est sa
comptabilité à lui, pas celle de ses clients, et elle est **saisie à la main** : les honoraires
facturés ne disent ni ce qui a été encaissé ni ce qui a été dépensé, et un chiffre déduit à
moitié serait pire qu'un chiffre assumé. Le montant facturé du mois est tout de même rappelé
sous le champ « revenus », comme repère.

Le graphique (`components/ui/MonthlyBars`) est du SVG rendu côté serveur : aucune bibliothèque,
donc rien à charger depuis un CDN que la politique de sécurité bloquerait, et il s'imprime avec
la page. Une barre par mois autour d'une ligne de zéro — verte au-dessus, rouge en dessous —
répond à la seule question qu'on lui pose. Les mois non saisis sont dessinés en creux : un trou
dans la série veut dire « à remplir », pas « zéro ». Les chiffres, eux, sont dans le tableau, avec
le **cumul depuis janvier**, qui est la façon dont un comptable lit son exercice.

`finance.view` / `finance.manage` sont réservées à l'administration : ce que gagne le cabinet ne
regarde pas ses collaborateurs.

### To-do de l'équipe

`Todo` est le travail que l'administration confie à un collaborateur, distinct de `Task` qui
porte le travail d'un dossier et que tout collaborateur peut créer. Le va-et-vient est le sujet :
l'administrateur confie, le collaborateur **rend** la tâche avec une note — faite, ou ce qui
manque —, et l'administrateur **confirme** après l'avoir lue. Trois états visibles, trois
couleurs : confiée, rendue (orange, elle attend), confirmée (vert, des deux côtés). Un quatrième,
« renvoyée », existe parce qu'un collaborateur qui écrit « il manque une pièce » n'a pas
terminé : sans lui, l'administrateur n'aurait d'autre choix que de clore une tâche inachevée.

`todo.manage` (administration) distribue et confirme ; `todo.view` (tout collaborateur) ne voit
que ce qui lui est confié — le service applique cette restriction quoi qu'affiche la page, la
répartition du travail des autres n'étant pas une information d'équipe.

**Un collaborateur s'ajoute directement**, avec un mot de passe initial que l'administration
communique. Le lien d'invitation a été retiré : sans envoi de courriel, il fallait de toute façon
le recopier à la main pour le même résultat, et la personne est en général dans le bureau d'à
côté. Un compte qui existe déjà garde son mot de passe et rejoint simplement le cabinet ; un
collaborateur retiré puis réajouté retrouve son accès.

**La section Équipe est réservée à l'administration** (`member.view`) : elle porte l'invitation,
les rôles et l'historique de chacun. Savoir qui compose son cabinet n'en dépend pas — les
sélecteurs « reçu par », « assigné à » passent par `listStaffOptions`, autorisé par la permission
de l'écran qui les affiche.

La fiche d'un collaborateur (`/team/<userId>`) montre ses tâches et **son historique**, construit
depuis le **journal d'audit** et non depuis le fil d'activité : l'audit enregistre tout, y compris
les modifications, qui sont précisément ce que l'administrateur veut relire. Les noms de dossiers
y sont résolus à travers le client Prisma du contexte — un dossier hors de portée reste anonyme
plutôt que de fuir par l'historique.

### Recherche

`contains` de Prisma est sensible à la casse sur SQLite, et `mode: "insensitive"` n'existe que
sur PostgreSQL : chercher « atlas » ne trouvait pas « Atlas Distribution », et le comptable en
concluait que la recherche ne marchait pas. Faire dépendre le comportement du moteur aurait
donné un produit qui se comporte autrement en test qu'en production.

Chaque table cherchable porte donc une colonne **`searchKey`** : le texte de ses champs utiles,
normalisé une fois à l'écriture — minuscules, accents retirés, espaces resserrés. La requête
subit la même normalisation, et un simple `contains` suffit alors partout, à l'identique. Chaque
mot de la saisie doit se retrouver, dans n'importe quel ordre.

Pour un dossier, la clé couvre le nom, l'ICE, l'IF, le RC et son tribunal, les numéros de taxe
professionnelle et de succursale, la CIN, la CNSS, le téléphone, l'e-mail, la ville — et le
contenu des listes JSON, si bien qu'un dossier se retrouve par le nom d'un gérant ou la CIN d'un
associé.

**Les clés sont définies dans `lib/search.ts`, et nulle part ailleurs** : le service et le
remplissage de la graine s'en servent tous les deux, et deux définitions produisaient deux clés
— c'est ce qui rendait une CIN d'associé introuvable après remplissage alors qu'elle l'était
après modification. La graine recalcule les clés à chaque déploiement et n'écrit que celles qui
ont changé : une clé périmée est aussi trompeuse qu'une clé absente.

`SearchPicker` est le pendant à l'écran : un champ qui cherche au lieu d'une liste déroulante de
plusieurs centaines de lignes. Le filtrage se fait dans le navigateur, sur la même clé et les
mêmes termes, et les résultats sont classés — un nom qui **commence** par la saisie passe avant
un nom qui la contient, lui-même avant une simple correspondance de numéro.

### Rendez-vous

`Appointment` porte le planning du cabinet : objet, client attendu, horaire, durée, lieu,
collaborateur qui reçoit, et ce qu'il faut préparer. Le calendrier (`/appointments`) est rendu
côté serveur à partir d'un module pur, `lib/calendar/month.ts` — pas de bibliothèque de
calendrier, rien à charger depuis un CDN que la politique de sécurité bloquerait. Le mois, le
jour affiché et les filtres passent par l'URL : une vue se partage et survit à un rechargement.

**Les horaires sont des heures murales.** `startsAt` est écrit et relu en UTC, sans conversion :
un rendez-vous saisi à 9 h s'affiche à 9 h, que le serveur tourne à Casablanca ou sur un
hébergeur réglé en UTC. Convertir aurait décalé tous les horaires d'une heure en production sans
erreur visible, et un cabinet n'exerce que dans un seul fuseau.

Valider un rendez-vous **crée une ligne dans la liste d'activité du client** : le compte rendu ne
reste pas dans le calendrier, où plus personne ne le relirait. La ligne créée est retenue
(`interventionId`), une seconde validation est refusée, et un rendez-vous validé ne se supprime
plus — il a produit une trace au dossier.

Un rendez-vous passé resté « prévu » est signalé partout comme « à valider ». Le retard n'est pas
un statut stocké, il se déduit de l'heure : sans ce rappel, un rendez-vous honoré mais jamais
validé disparaîtrait dans le passé du calendrier et son compte rendu ne serait jamais écrit.

### Liste d'activité

`Intervention` est le registre, **écrit à la main**, de ce que le cabinet a fait pour un
client : nom du service, date, motif, compte rendu. Il ne se déduit d'aucune autre table —
un rendez-vous, un passage à la DGI, une régularisation ne laissent aucune trace ailleurs —
et il s'imprime avec la fiche, pour le classeur papier.

À ne pas confondre avec `Activity`, la trace **automatique** de ce que la plateforme
enregistre. Les deux apparaissent sur le dossier, sous deux titres distincts : « Liste
d'activité » pour le registre du comptable, « Journal du dossier » pour la trace machine.

Le modèle est déclaré dans `TENANT_MODELS` **et** `STRICT_CLIENT_MODELS` : sans la seconde
entrée, un collaborateur restreint à ses dossiers assignés aurait lu les comptes rendus des
autres. Les permissions `intervention.view` / `intervention.manage` séparent la lecture de
l'écriture — l'assistant lit, il n'écrit pas.

`Client.referredById` désigne le dossier du cabinet qui a apporté celui-ci. La relation est
vérifiée côté service, à travers le client Prisma du contexte : un dossier d'un autre cabinet est
introuvable, et un dossier ne peut pas être son propre apporteur.

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
