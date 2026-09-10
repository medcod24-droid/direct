# Prompt — refonte visuelle de Direct Conseil

À coller tel quel. Les contraintes techniques y sont incluses : ce sont celles qui, omises,
produisent une maquette impossible à intégrer.

---

Tu refonds l'interface de **Direct Conseil**, un SaaS de gestion pour cabinets comptables
marocains (OPCA / OEC). L'application existe et fonctionne ; je veux **changer sa couche
visuelle**, pas ses fonctionnalités. Le style actuel est correct mais fade : je veux le niveau
de finition d'un SaaS professionnel moderne — pense Linear, Stripe, Vercel, Height : minimal,
hiérarchie nette, bordures subtiles plutôt qu'ombres lourdes, un seul accent, mouvement discret.

## Qui l'utilise

Un comptable marocain et son équipe (2 à 10 personnes), toute la journée, sur des écrans de
bureau, en français. Ce n'est pas un site vitrine : c'est un outil de travail dense. Ils y lisent
des tableaux d'échéances fiscales, des montants, des dates. **Lisibilité et densité avant
l'esthétique** — mais les deux sont possibles.

## Écrans à couvrir

- **Tableau de bord** — échéances en retard du mois, to-do de l'équipe, rendez-vous du jour,
  graphique de résultat mensuel
- **Clients** — liste filtrable et recherche ; **fiche client** (identité, registre de commerce
  arborescent, échéances, documents, liste d'activité) ; **formulaire** long (40+ champs,
  sections, groupes répétables) ; **fiche imprimable** A4
- **Échéances** — grand tableau avec statuts de conformité, onglets, filtres
- **Rendez-vous** — calendrier mensuel + panneau latéral du jour
- **To-do équipe** — cartes de tâches par collaborateur, avec cycle de validation
- **Résultat** — graphique en barres + tableau mensuel
- **Documents · Demandes · Tâches · Honoraires · Équipe · Paramètres · Notifications**
- **Connexion / création de cabinet** — les deux seuls écrans « vitrine »
- **Portail client** — vue réduite, pour le client du cabinet

## Composants existants à redessiner (garder les noms et les props)

`Alert` `Avatar` `Badge` `Button` `Card` `EmptyState` `Field` `Input` `Logo` `Modal`
`MonthlyBars` `PageHeader` `Pagination` `SearchPicker` `Select` `StarRating` `StatTile`
`StatusPill` `Table` `Tabs` `Textarea` `ThemeToggle`

Ils sont utilisés par une vingtaine de pages : **l'API publique de chaque composant ne doit pas
changer**. Tu peux réécrire le balisage interne et les classes, pas la signature.

## Contraintes techniques — non négociables

1. **Next.js 15 + Tailwind 3.4.** Pas de bibliothèque de composants, pas de CSS-in-JS.
2. **Aucune ressource externe.** La politique de sécurité (`default-src 'self'`,
   `font-src 'self' data:`) bloque Google Fonts et tout CDN. Le socle actuel est la pile système
   (`ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, …`) et elle inclut
   `"Noto Sans Arabic"`. Si tu proposes une autre police, elle devra être **auto-hébergée** :
   dis-le explicitement et justifie-le.
3. **Toutes les couleurs passent par des variables CSS.** Aucun code hexadécimal dans un
   composant. Les jetons existants sont mappés dans `tailwind.config.ts` : `bg` `surface`
   `surface2` `ink` `ink2` `muted` `line` `accent` `accentInk` `accentSoft` `danger`
   `dangerSoft` `warn` `warnSoft` `ok` `okSoft`. Tu peux en ajouter, pas les contourner.
4. **Trois états de thème.** Palette complète sur `:root`, redéfinie sous
   `@media (prefers-color-scheme: dark)` *guardée par* `:root:not([data-theme="light"])`, puis
   de nouveau sous `:root[data-theme="dark"]` pour que le bouton de thème gagne dans les deux
   sens. Le mode sombre est utilisé, il n'est pas décoratif.
5. **Prêt pour l'arabe (RTL).** Le code n'utilise que des propriétés logiques : `ps-` `pe-`
   `ms-` `me-` `text-start` `text-end` `border-s` `border-e`. N'introduis jamais `left`/`right`.
   Les montants et les dates portent `.tabular`, qui les isole en LTR même en arabe.
6. **Rouge, ambre et vert sont réservés aux statuts de conformité** — en retard, à confirmer, à
   jour. Jamais décoratifs. C'est une règle produit : un cabinet lit la couleur avant le texte.
7. **Les montants sont en chiffres tabulaires, alignés à droite.** Un tableau de montants qui ne
   s'aligne pas en colonne est un défaut, pas un choix.
8. **Impression.** `/clients/<id>/fiche` s'imprime en A4 et se classe dans un dossier papier :
   fond blanc, encre noire, nav masquée, sections non coupées entre deux pages.
9. **Accessibilité réelle** : contraste AA sur les deux thèmes, anneau de focus visible partout,
   cibles tactiles ≥ 36 px, aucune information portée par la seule couleur.

## Ce que je veux recevoir

**1. Une maquette HTML autonome** (un seul fichier, Tailwind par la balise `script` de la play
CDN acceptée *pour la maquette uniquement*) montrant, avec des données réalistes en français :

- le tableau de bord,
- la liste des clients avec sa recherche,
- la fiche client,
- le tableau des échéances,
- un formulaire long,
- et un aperçu des composants (boutons, badges, champs, modale, tableau, états vides).

Le tout **en clair et en sombre**, avec un bouton pour basculer.

**2. Le système de design en clair**, sous la maquette :

- la palette complète des jetons, valeurs pour les deux thèmes, avec le rôle de chacun ;
- l'échelle typographique (tailles, graisses, hauteurs de ligne) et où chaque niveau s'emploie ;
- l'échelle d'espacement et le rythme vertical ;
- les rayons, les bordures, les ombres ;
- pour **chaque composant de la liste ci-dessus**, la recette de classes Tailwind à appliquer,
  variantes et états compris (repos, survol, focus, désactivé, chargement).

**3. Trois décisions argumentées**, en trois phrases chacune : ce que tu changes de la palette
actuelle et pourquoi ; comment tu obtiens de la respiration sans perdre en densité dans les
tableaux ; ce que tu fais de l'accent vert-sarcelle du logo.

## Palette actuelle, pour référence

Accent : vert-sarcelle profond `#0e6a59` (clair) / `#35a58c` (sombre) — il vient du logo, qui
est blanc et vert et ne se lit que sur fond sombre. Les neutres sont **légèrement teintés vers
l'accent, jamais du gris pur** : `#f1f5f4` `#ffffff` `#e8efed` `#0c1a17` `#37504b` `#5d7873`
`#d4e0dd` en clair ; `#08120f` `#0f1c19` `#172724` `#e7efec` `#b2c7c2` `#85a09a` `#233733` en
sombre. Conformité : `#b3261e` rouge, `#8a5a00` ambre, `#1a6b45` vert.

Garde cette identité si elle te paraît juste, corrige-la si elle ne l'est pas — mais dis-le.

## Ce qu'il ne faut pas faire

- Pas de dégradés décoratifs, pas de « glassmorphism », pas d'ombres portées épaisses.
- Pas d'emoji dans l'interface.
- Pas de libellés en anglais : le produit est en français.
- Pas de tableau transformé en cartes sur grand écran : un comptable compare des lignes.
- Pas d'animation qui retarde une action.

## Enfin

Propose **deux directions** distinctes avant de développer celle que je choisirai — l'une sobre
et institutionnelle, l'autre plus affirmée — et dis en une phrase ce que chacune coûte.
