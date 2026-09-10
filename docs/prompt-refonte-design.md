# Prompt maître — refonte visuelle de Direct Conseil

À coller tel quel. Il remplace le brief précédent, dont le rendu manquait de matière : pas
d'icônes, pas d'indicateurs, une mise en page trop sage.

---

Tu es le designer produit d'un SaaS professionnel. Tu refonds l'interface de **Direct Conseil**,
un outil de gestion pour cabinets comptables marocains (OPCA / OEC). L'application existe et
fonctionne ; tu changes **la couche visuelle**, pas les fonctionnalités.

Le rendu attendu est celui d'un produit financier haut de gamme : dense, instrumenté, chaque
bloc portant une icône, un compteur et un indicateur d'avancement. Pas une maquette sage — un
tableau de bord qu'un dirigeant ouvre le matin et lit en dix secondes.

## Qui l'utilise

Un comptable marocain et son équipe, 2 à 10 personnes, toute la journée, en français, sur écran
de bureau. Ils lisent des échéances fiscales, des montants en dirhams, des états de conformité.
**Outil de travail dense, pas site vitrine.**

## La référence

Prends comme niveau de finition les tableaux de bord financiers modernes du type FinPilot /
Linear / Stripe Dashboard. Ce que j'en veux, précisément :

1. **Puce d'icône** en haut de chaque carte : carré arrondi 32–36 px, fond teinté à 10–15 %,
   glyphe en trait de 1,75 px de la couleur du jeton.
2. **Cartes de KPI** : libellé en petites capitales espacées, **nombre très grand** (28–36 px,
   graisse 600, chiffres tabulaires), **pastille de variation** avec flèche (`↑ 12 %`) sur fond
   teinté, et une ligne de comparaison en dessous (« août 2026 : 5 »).
3. **Barre latérale** : icône + libellé, **ligne active en pilule pleine**, compteur à droite de
   chaque entrée, groupes repliables avec chevron, séparateur avant le bas de la liste.
4. **Barre supérieure** : recherche large avec indice clavier `⌘K`, sélecteur de période, bascule
   de thème, cloche de notifications avec pastille, avatar.
5. **Contrôle segmenté** pour les périodes et les filtres : le segment actif encadré, pas
   simplement coloré.
6. **Graphiques** : aire avec dégradé sous la courbe, barres à coins arrondis, barres divergentes
   de part et d'autre d'un zéro, courbes multi-séries à points, **jauge radiale** avec un grand
   pourcentage au centre et un mot d'état. Légendes à points colorés.
7. **Micro-graphiques dans les tableaux** : une sparkline ou une barre de 40 px dans la cellule,
   là où une tendance vaut mieux qu'un chiffre.
8. **Lignes de liste à trois zones** : puce d'icône, deux lignes de texte, valeur alignée à
   droite. C'est le motif des rendez-vous, des tâches, de l'activité récente.
9. **Menu de débordement** discret (⋯) sur l'en-tête des cartes.
10. **Pastilles d'état** compactes et sans emoji : « Déposée », « En retard », « À confirmer ».
11. **Grille asymétrique** : 2/3 – 1/3, jamais douze cartes identiques alignées.
12. **Profondeur par la bordure et le fond**, pas par l'ombre : fond de page le plus sombre,
    carte un cran plus clair, bordure 1 px à peine visible, liseré supérieur légèrement plus
    clair sur les cartes principales.

**Ce que je rejette de cette référence** : les fonds violets et bleus, les dégradés décoratifs,
les hachures dans les barres, les blocs promotionnels « Upgrade to pro », l'anglais, et les
métriques inventées. Chaque chiffre affiché doit correspondre à une donnée que le produit
possède réellement (liste plus bas).

## Identité : vert profond + or

La marque est **vert sarcelle profond et or**. Le vert porte le chrome et les surfaces, l'or
porte l'accent, les valeurs et les moments de réussite.

Point de départ, à ajuster :

| Rôle | Sombre | Clair |
|---|---|---|
| Fond de page | `#071411` | `#f2f6f4` |
| Surface / carte | `#0d1d19` | `#ffffff` |
| Surface secondaire | `#142925` | `#e6efec` |
| Bordure | `#1f3a34` | `#d3e0dc` |
| Vert de marque | `#2f9e86` | `#0e6a59` |
| **Or de marque** | `#d9b45e` | `#8a6a1c` |
| Or teinté (fonds) | `#33270e` | `#f6ecd4` |

**Deux pièges à résoudre explicitement, et à documenter :**

- **L'or n'a pas le contraste requis sur fond clair.** Prévois une variante foncée pour le thème
  clair et vérifie AA sur du texte de 13 px.
- **L'or entre en collision avec l'ambre des avertissements.** Dans ce produit, rouge / ambre /
  vert ont un sens réglementaire : en retard, à confirmer, à jour. Un cabinet lit la couleur
  avant le texte. Il faut donc soit deux teintes franchement distinctes — or de marque
  nettement plus chaud et plus clair que l'ambre d'alerte —, soit un avertissement qui ne
  s'appuie plus sur l'ambre seul mais sur une icône et une bordure. **Tranche, et écris la
  règle** : « l'or ne signifie jamais un état ; il signifie une valeur ».

Les neutres restent **légèrement teintés vers le vert, jamais du gris pur**. Le logo est blanc et
vert et ne se lit que sur fond sombre — en thème clair il repose sur une plaque sombre.

## Indicateurs d'avancement — exigence centrale

Aucun ensemble à plusieurs états ne doit s'afficher sans dire **où il en est**. C'est ce qui
manque aujourd'hui et c'est ce que je veux voir partout.

- **To-do de l'équipe** — par collaborateur : une **barre segmentée** en trois parts (à faire /
  rendue en attente / confirmée) avec sa légende, et un libellé chiffré du type « 8 confirmées
  sur 12 ». Une **jauge radiale** pour l'équipe entière en tête de section.
- **Échéances du mois** — « 27 déposées sur 34 » avec une barre de progression, et la part en
  retard détachée en rouge à l'extrémité.
- **Fiche client** — un indicateur de **complétude du dossier** : combien de pièces
  justificatives sont attachées sur celles attendues (« dossier complété à 60 % — 6 pièces sur
  10 »), avec la liste de ce qui manque.
- **Chaque échéance d'un tableau** — une micro-barre du temps restant : verte loin de la date,
  ambre à l'approche, rouge au-delà.
- **Résultat du cabinet** — les mois saisis sur douze (« 6 mois sur 12 renseignés »), en plus du
  graphique.
- **Rendez-vous du jour** — honorés sur prévus.
- **Compteurs dans la barre latérale** : nombre d'éléments demandant une action, sur chaque
  entrée. Une pastille colorée uniquement quand il y a un retard.

Chaque compteur doit être compréhensible sans survol : la valeur, le total, et l'unité.

## Icônes

Une icône par entrée de navigation, par carte, par type de ligne, par action, par état vide.
Trait de 1,75 px, 20 px dans les listes, 24 px dans la navigation, `currentColor`, jamais de
remplissage plein. Géométrie du type Lucide / Phosphor.

**Elles doivent être en SVG inline dans le code** — la politique de sécurité du produit
(`default-src 'self'`) bloque tout CDN, police d'icônes comprise. Un paquet npm regroupé au
build est acceptable ; un `<link>` ou un `<script>` externe ne l'est pas.

Choisis un vocabulaire cohérent et donne la correspondance : dossier client, échéance fiscale,
document, rendez-vous, tâche, honoraires, résultat, équipe, paramètres, dépôt effectué, retard,
en attente de validation, pièce manquante, recherche, impression.

## Données réelles du produit — à utiliser dans la maquette

Obligations : TVA mensuelle et trimestrielle, acompte d'IS, IR sur salaires, CNSS, taxe
professionnelle, liasse fiscale, déclaration CPU. Formes : SARL, SARL AU, SA, association,
coopérative, auto-entrepreneur, CPU, RNR. Montants en **MAD**, séparateur d'espace, deux
décimales. Noms et villes marocains. États d'échéance : à venir, en cours, déclarée, payée, en
retard. États de tâche : à faire, rendue, confirmée, renvoyée.

## Écrans à livrer

1. **Tableau de bord** — le morceau de bravoure : bandeau de KPI, échéances du mois avec
   progression, to-do de l'équipe par collaborateur avec barres segmentées, rendez-vous du jour,
   graphique du résultat mensuel en barres divergentes autour de zéro, jauge de santé du cabinet.
2. **Clients** — liste dense avec recherche, filtres segmentés, note en étoiles, état de santé,
   micro-indicateur d'échéances.
3. **Fiche client** — identité, arborescence du registre de commerce, complétude du dossier,
   échéances, documents, liste d'activité.
4. **Échéances** — grand tableau, onglets d'état, barre de progression du mois.
5. **Rendez-vous** — calendrier mensuel + panneau du jour.
6. **To-do équipe** — cartes par collaborateur, cycle à trois états, barres segmentées.
7. **Résultat** — barres divergentes, cumul, marge, tableau mensuel.
8. **Formulaire long** — 40 champs, sections, groupes répétables, dépôt de pièce par champ.
9. **Connexion** — le seul écran de marque.
10. **Aperçu des composants** — tous les états.

Livre-les **en thème sombre et en thème clair**, avec un bouton de bascule.

## Composants à redessiner — noms et props inchangés

`Alert` `Avatar` `Badge` `Button` `Card` `EmptyState` `Field` `Input` `Logo` `Modal`
`MonthlyBars` `PageHeader` `Pagination` `SearchPicker` `Select` `StarRating` `StatTile`
`StatusPill` `Table` `Tabs` `Textarea` `ThemeToggle`

Une vingtaine de pages les consomment : **l'API publique ne change pas**. Tu réécris le balisage
interne et les classes. Ajoute les composants qui manquent — `ProgressBar`, `SegmentedProgress`,
`Gauge`, `Sparkline`, `IconChip`, `DeltaPill`, `SegmentedControl`, `StatCard` — en donnant leur
API.

## Contraintes techniques — non négociables

1. **Next.js 15 + Tailwind 3.4.** Pas de bibliothèque de composants, pas de CSS-in-JS.
2. **Aucune ressource externe.** `default-src 'self'`, `font-src 'self' data:` : ni Google Fonts,
   ni CDN, ni bibliothèque de graphiques distante. Le socle typographique est la pile système,
   qui inclut `"Noto Sans Arabic"`. Une autre police devra être auto-hébergée : dis-le et
   justifie-le. Pour la maquette seule, le script de la play CDN de Tailwind est toléré.
3. **Tous les graphiques en SVG inline**, écrits à la main, dégradés compris
   (`<linearGradient>`). Aucune dépendance de graphiques.
4. **Toutes les couleurs par variables CSS**, aucun hexadécimal dans un composant. Jetons
   existants : `bg` `surface` `surface2` `ink` `ink2` `muted` `line` `accent` `accentInk`
   `accentSoft` `danger` `dangerSoft` `warn` `warnSoft` `ok` `okSoft`. Ajoute ceux qu'il faut
   pour l'or.
5. **Trois états de thème** : palette complète sur `:root`, redéfinie sous
   `@media (prefers-color-scheme: dark)` **guardée par** `:root:not([data-theme="light"])`, puis
   sous `:root[data-theme="dark"]` pour que la bascule gagne dans les deux sens.
6. **Prêt pour l'arabe.** Propriétés logiques uniquement : `ps-` `pe-` `ms-` `me-` `text-start`
   `text-end` `border-s` `border-e`. Jamais `left` ni `right`. Les montants et les dates portent
   `.tabular`, qui les isole en LTR.
7. **Montants en chiffres tabulaires, alignés à droite.** Une colonne de montants qui ne
   s'aligne pas est un défaut.
8. **Impression.** Une fiche client s'imprime en A4 et se classe dans un dossier papier : fond
   blanc, encre noire, navigation masquée, sections non coupées entre deux pages, graphiques
   lisibles en noir et blanc.
9. **Accessibilité** : AA sur les deux thèmes, anneau de focus visible partout, cibles ≥ 36 px,
   aucune information portée par la seule couleur — un état porte toujours une icône ou un mot.

## Livrables

**1. Une maquette HTML autonome**, un seul fichier, données réalistes en français, les dix
écrans, les deux thèmes, tous les indicateurs en place.

**2. Le système de design en clair**, sous la maquette :
- la palette complète, valeurs pour les deux thèmes, rôle de chaque jeton, et **la règle qui
  sépare l'or de marque de l'ambre d'alerte** ;
- l'échelle typographique et l'emploi de chaque niveau ;
- l'échelle d'espacement, le rythme vertical, les rayons, les bordures, l'élévation ;
- pour **chaque composant**, la recette de classes Tailwind, variantes et états compris — repos,
  survol, focus, désactivé, chargement, erreur ;
- le jeu d'icônes et sa correspondance.

**3. Quatre décisions argumentées**, trois phrases chacune : comment l'or et l'ambre cohabitent ;
comment tu gardes la densité des tableaux tout en aérant la page ; ce que devient le logo en
thème clair ; ce que tu fais des cartes de KPI quand un cabinet n'a encore aucune donnée.

## Ce qu'il ne faut pas faire

- Pas de « glassmorphism », pas de dégradé décoratif de fond, pas d'ombre portée épaisse.
- Pas d'emoji dans l'interface.
- Pas un mot d'anglais : le produit est en français.
- Pas de tableau transformé en cartes sur grand écran : un comptable compare des lignes.
- Pas d'animation qui retarde une action ; le mouvement se limite à 150 ms sur la couleur et
  l'opacité.
- Pas de compteur sans total : « 7 » ne veut rien dire, « 7 sur 34 » oui.
- Pas de chiffre inventé : chaque métrique correspond à une donnée listée plus haut.

## Enfin

Une seule direction, poussée jusqu'au bout. J'ai vu assez de variantes : je veux la version
finie, complète, avec ses indicateurs et ses icônes.
