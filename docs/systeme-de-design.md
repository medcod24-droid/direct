# Système de design

Refonte visuelle appliquée en septembre 2026. Identité **vert sarcelle profond et or**, densité
d'outil professionnel, profondeur par la bordure plutôt que par l'ombre.

Tout est branché sur `src/app/globals.css` (jetons) et `tailwind.config.ts` (correspondance).
**Aucun code hexadécimal dans un composant** : une couleur écrite en dur casse l'un des deux
thèmes sans qu'on le voie.

## Jetons

| Rôle | Clair | Sombre |
|---|---|---|
| `bg` — fond de page | `#f2f6f4` | `#071411` |
| `surface` — carte | `#ffffff` | `#0d1d19` |
| `surface2` — fond enfoncé, en-tête de tableau | `#e9f0ee` | `#142925` |
| `ink` / `ink2` / `muted` — texte | `#0b1a16` · `#37504b` · `#5d7873` | `#e9f2ef` · `#b3c8c3` · `#7f9a94` |
| `line` — bordure | `#d3e0dc` | `#1f3a34` |
| `edge` — liseré supérieur des cartes | `rgb(11 26 22 / 3.5%)` | `rgb(255 255 255 / 5.5%)` |
| `accent` — vert de marque | `#0e6a59` | `#2f9e86` |
| `gold` — or de marque | `#7a5a12` | `#d9b45e` |
| `danger` / `warn` / `ok` — conformité | `#b3261e` · `#a04a06` · `#17683f` | `#f0a9a4` · `#e9944e` · `#63c996` |
| `chrome` — barre latérale | `#ffffff` | `#061210` |
| `plate` — plaque du logo | `#0b1a16` | `#061210` |

Les neutres sont **légèrement teintés vers le vert, jamais du gris pur**.

### Les deux règles de couleur

**L'or ne signifie jamais un état, il signifie une valeur.** Sur-titre de page, montant en
honoraires, jauge de santé, note en étoiles, bouton d'impression. Jamais un statut.

**Rouge, orange et vert sont réservés à la conformité** — en retard, à confirmer, à jour. Un
cabinet lit la couleur avant le texte. L'avertissement est donc **orange** (`#a04a06` /
`#e9944e`) et non doré : les deux devaient se distinguer au premier regard. Et parce qu'une
information ne doit jamais tenir à la seule couleur, chaque statut porte aussi une icône —
c'est ce qui reste lisible à l'impression en noir et blanc.

### Trois états de thème

Palette complète sur `:root`, redéfinie sous `@media (prefers-color-scheme: dark)` **guardée par**
`:root:not([data-theme="light"])`, puis de nouveau sous `:root[data-theme="dark"]` pour que la
bascule gagne dans les deux sens.

## Échelles

- **Typographie** : `2xs` 10,5 (capitales espacées) · `xs` 11,5 · `sm` 13 · `base` 14 · `md` 15
  (titre de carte) · `xl` 20 · `2xl` 24 (titre de page) · `4xl` 32 (valeur de KPI).
  Graisses `550` et `650` sont ajoutées : `700` est trop lourd à 13 px.
- **Rayons** : `chip` 9 px (puces, lignes de navigation) · `control` 10 px (champs, boutons) ·
  `card` 14 px.
- **Hauteur des contrôles** : 38 px partout — champs, boutons, sélecteurs. Une ligne de
  formulaire et un bouton doivent s'aligner.
- **Élévation** : `shadow-edge` (liseré interne) sur les cartes, `shadow-panel` sur les modales
  seulement. Pas d'ombre portée sur les cartes : invisible sur fond sombre, salissante sur fond
  clair.
- **Chiffres** : tout montant, date ou compteur porte `.tabular`, qui les aligne en colonne et
  les isole en LTR même en arabe.

## Icônes

39 tracés dans `components/ui/Icon.tsx`, grille de 24, trait 1,75 px, `currentColor`.
**En ligne, jamais depuis un CDN** : la politique de sécurité (`default-src 'self'`) bloque toute
police d'icônes distante, et une icône qui ne se charge pas laisse un bouton muet.

Tailles : 20 dans les listes et la navigation, 18 dans les boutons, 13 dans les pastilles d'état.

`IconChip` est le motif d'ouverture de chaque carte et de chaque ligne de liste : carré arrondi,
fond teinté, glyphe coloré. Le ton suit la sémantique du bloc.

## Indicateurs — la règle centrale

**Aucun ensemble à plusieurs états ne s'affiche sans dire où il en est, et aucun compteur sans
son total.** « 7 » ne veut rien dire, « 7 sur 34 » oui.

| Composant | Emploi |
|---|---|
| `SegmentedProgress` | To-do par collaborateur, échéances du mois par statut |
| `ProgressBar` | Retard d'une échéance, reste à courir |
| `Gauge` | Santé du cabinet, complétude d'un dossier |
| `DeltaPill` | Variation d'un KPI, avec son sens métier (`good`) |
| `CountBadge` | Navigation, onglets, en-têtes de section |
| `MonthlyBars` | Résultat mensuel, barres divergentes autour de zéro |

`DeltaPill` prend `good` parce que le ton ne se déduit pas de la direction : pour un retard,
monter est une mauvaise nouvelle.

## Chrome

**Barre latérale** — 248 px, `bg-chrome`, trois groupes titrés (Suivi, Travail, Cabinet) : onze
entrées plates ne se parcourent pas. Chaque entrée porte son compteur d'éléments **demandant une
action**, en rouge quand il s'agit d'un retard. L'état actif est une pilule pleine, pas une
nuance de couleur. Paramètres et Notifications sont épinglés en bas.

Le logo est blanc et vert : il ne se lit que sur une plaque sombre (`plate`), y compris en thème
clair.

**Barre supérieure** — 60 px : recherche globale avec indice `⌘K` (le raccourci existe
réellement, il focalise le champ), bascule de thème, cloche avec pastille, identité, déconnexion.

## Impression

`@media print` masque la navigation et les boutons, force fond blanc et encre noire, et empêche
les sections de se couper entre deux pages. La fiche client (`/clients/<id>/fiche`) est faite pour
ça : elle s'imprime en A4 et se classe dans le dossier papier.

## Ce qu'on ne fait pas

Pas de dégradé décoratif, pas de « glassmorphism », pas d'ombre portée épaisse. Pas d'emoji dans
l'interface. Pas un mot d'anglais. Pas de tableau transformé en cartes sur grand écran — un
comptable compare des lignes. Pas d'animation qui retarde une action : le mouvement se limite à
150 ms sur la couleur.
