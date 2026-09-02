# Sécurité

Toute donnée de ce produit est sensible : identité des dirigeants, chiffres d'affaires,
documents fiscaux, pièces d'identité. Le principe tenu partout est **refus par défaut,
autorisation explicite**.

## Isolation entre cabinets

L'isolation ne dépend ni du frontend, ni de la vigilance du développeur.

`tenantDb({ cabinetId, clientIds })` (`src/lib/db/tenant.ts`) est un client Prisma étendu qui,
pour chaque modèle appartenant à un cabinet :

- injecte `cabinetId` dans le `where` de toute lecture (`findUnique`, `findFirst`, `findMany`,
  `count`, `aggregate`, `groupBy`) ;
- injecte `cabinetId` dans le `where` de toute écriture ciblée (`update`, `updateMany`,
  `delete`, `deleteMany`) ;
- écrase `cabinetId` dans le `data` de toute création — un identifiant de cabinet fourni par
  l'appelant est ignoré ;
- refuse de se construire sans `cabinetId` : il n'existe aucun repli sur « tout voir » ;
- lève une erreur sur une opération non couverte plutôt que de laisser passer la requête.

Le filtre est ajouté dans un `AND` en conservant les clés d'origine au premier niveau, pour que
`findUnique` et `delete` gardent leur champ unique.

`platformDb` est le client non filtré. Son nom le signale en revue de code. Il n'est utilisé que
pour l'authentification, les plans, le compteur de stockage du cabinet courant et le journal
d'audit.

Le modèle `Cabinet` est filtré par `id`. Les lignes système (`DocumentCategory`, `DeadlineRule`
avec `cabinetId = null`) sont lisibles par tous les cabinets et modifiables par aucun.

## Rôles et portée

Cinq rôles : `owner`, `admin`, `accountant`, `assistant`, `client`. Les permissions sont une
liste fermée (`src/lib/authz/permissions.ts`) ; une permission absente est refusée.

Deux niveaux de portée s'ajoutent au cabinet :

- un collaborateur marqué `restrictedToAssigned` ne voit que ses dossiers assignés ;
- un compte `client` ne voit que le dossier auquel il est rattaché.

Cette portée est appliquée **dans le client Prisma**, pas dans les pages. Une portée vide ne
donne accès à rien.

Chaque refus est journalisé (`authz.denied`, `document.access_denied`,
`client.access_denied`) avec `outcome = "denied"`.

## Authentification

- Mots de passe hachés en bcrypt (coût 12), politique de 12 caractères minimum avec majuscule,
  minuscule et chiffre, liste de mots de passe courants refusés.
- Session par cookie `httpOnly`, `SameSite=Lax`, `Secure` en production. Le jeton en clair
  n'existe que dans le cookie ; la base ne stocke que son SHA-256 salé par `APP_SECRET`.
- Durée de session 12 h, plafond absolu 30 jours.
- Verrouillage temporaire de 15 minutes après 5 échecs, et réponse identique que l'adresse
  existe ou non.
- L'architecture 2FA est en place dans le schéma (`twoFactorSecret`, `twoFactorEnabled`) mais
  **n'est pas encore activée**.

## Documents

- Stockage hors racine web (`var/storage`), jamais servi statiquement. Aucune URL publique
  n'existe.
- Le nom d'origine n'est jamais utilisé sur le disque : la clé est un UUID opaque, préfixé par
  le cabinet. Toute clé est vérifiée contre la traversée de chemin avant lecture ou écriture.
- Contrôles à l'entrée : taille, type MIME sur liste blanche, cohérence extension/type, et
  vérification de la signature binaire pour les formats qui en ont une.
- Empreinte SHA-256 et horodatage à chaque dépôt : intégrité au sens de la loi 53-05.
- Le seul chemin d'accès est `GET /api/documents/[id]/download`, qui vérifie la permission, le
  cabinet et la portée, puis journalise le téléchargement. Un identifiant appartenant à un autre
  cabinet est « introuvable », jamais « interdit » : la réponse ne révèle pas l'existence de la
  ressource.
- Un document servant de preuve de dépôt ne peut pas être supprimé sans être détaché.

## Journal d'audit

Table `AuditLog` en ajout seul : aucune mise à jour ni suppression n'est exposée par
l'application. Sont enregistrés la connexion, l'échec de connexion, la déconnexion, la création
et la modification de dossier, le dépôt, la consultation, le téléchargement et la suppression de
document, les demandes de pièces et leur validation, les changements d'échéance, les paiements,
et tout refus d'autorisation.

Les métadonnées sont filtrées avant écriture : toute clé contenant `password`, `token`,
`secret`, `authorization`, `cookie` ou `cin` est retirée, et les chaînes sont tronquées. Aucun
contenu de document n'est journalisé.

## Protection des données (loi 09-08)

La vérification des délibérations publiées par la CNDP a établi qu'**aucune dispense** ne
couvre la tenue de comptabilité, et que le stockage d'un numéro de CIN fait basculer le fichier
du cabinet en autorisation préalable. Le produit en tient compte :

- `Cabinet.cndpMode` vaut `declaration` par défaut. Dans ce mode, l'enregistrement d'un numéro
  de CIN est **refusé par le serveur**, avec un message explicite. Le mode `authorization` ne
  s'active qu'après obtention de l'autorisation par le cabinet.
- L'hébergement par défaut est au Maroc : héberger à l'étranger constitue un transfert (art.
  43-44) à notifier par chaque cabinet client.
- Le canal WhatsApp est désactivé pour la même raison.
- Chaque cabinet reste responsable de traitement ; l'éditeur est sous-traitant et doit signer un
  contrat au sens de l'art. 23.

Le produit ne revendique aucune « certification CNDP » : cette certification n'existe pas.

## Scénarios testés

`tests/security/` (29 tests) rejoue les attaques exigées :

| Scénario | Résultat attendu | Couvert |
|---|---|---|
| Le cabinet A lit, modifie ou supprime une donnée du cabinet B | Introuvable, aucune modification | oui |
| Un `cabinetId` falsifié est envoyé à la création | Écrasé par le cabinet de la session | oui |
| Un client du portail vise le dossier d'un autre client | Introuvable | oui |
| Un collaborateur restreint vise un dossier non assigné | Introuvable | oui |
| Téléchargement par identifiant direct d'un document d'un autre cabinet | 404 et refus journalisé | oui |
| Assignation d'une tâche à un utilisateur d'un autre cabinet | Refus | oui |
| Un assistant supprime ou valide un document, consulte les honoraires | Refus | oui |
| Dépassement des limites du plan | Refus explicite, message clair | oui |
| Abonnement expiré | Création bloquée | oui |
| Numéro de CIN en mode déclaration | Refus | oui |
| Fuite de secret dans le journal d'audit | Métadonnées filtrées | oui |
| Traversée de chemin sur une clé de stockage | Exception | oui |

## Limites connues, à traiter avant mise en ligne

1. **`'unsafe-inline'` sur les scripts** dans la politique de sécurité de contenu. Next.js en a
   besoin pour ses scripts d'amorçage ; le remplacement par un nonce demande un middleware qui
   pose l'en-tête par requête.
2. **2FA non activée** : le schéma est prêt, l'interface reste à faire.
3. **Pas de limitation de débit sur les actions serveur** en dehors du verrouillage de compte à
   la connexion. À ajouter au niveau du reverse proxy ou par un middleware.
4. **Pas d'analyse antivirus** des fichiers déposés. L'architecture le permet (une étape entre
   la validation et l'écriture) mais aucun moteur n'est branché.
5. **Chiffrement au repos** : assuré par le disque de l'hébergeur, pas par l'application.
   Un chiffrement par cabinet est un durcissement possible.
6. **Le mode client Prisma reste applicatif** : en production PostgreSQL, activer en plus la
   sécurité au niveau des lignes (RLS) donnerait une seconde barrière au niveau de la base.
7. **Aucune revue de sécurité externe** n'a été menée. Une revue indépendante et un avis
   juridique marocain (CNDP, périmètre commercial au regard de la loi 127-12) sont nécessaires
   avant de traiter des données réelles de clients.

## Signaler une vulnérabilité

Aucun processus public n'est encore en place. À définir avant l'ouverture commerciale.
