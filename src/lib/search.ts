/**
 * Normalisation des recherches.
 *
 * `contains` de Prisma est sensible à la casse sur SQLite, et `mode:
 * "insensitive"` n'existe que sur PostgreSQL : chercher « atlas » ne trouvait
 * pas « Atlas Distribution », et le comptable en concluait que la recherche ne
 * marchait pas. Plutôt que de faire dépendre le comportement du moteur, chaque
 * table cherchable porte une colonne `searchKey` : le texte de ses champs
 * utiles, normalisé une fois à l'écriture. La requête est normalisée de la même
 * façon, et un simple `contains` suffit alors partout, à l'identique.
 *
 * Module pur : aucune dépendance à la base ni au moteur.
 */

/**
 * Minuscules, accents retirés, espaces resserrés.
 *
 * Les accents sont retirés des deux côtés : au Maroc les noms s'écrivent
 * indifféremment « Meknès » ou « Meknes », et une recherche ne doit pas dépendre
 * du clavier de celui qui tape.
 */
export function normalizeSearch(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Clé de recherche d'une ligne : ses champs utiles mis bout à bout.
 *
 * Les valeurs vides sont écartées, les doublons aussi — un ICE répété dans deux
 * champs n'apporte rien et allonge la colonne pour rien.
 */
export function buildSearchKey(...parts: (string | null | undefined)[]): string {
  const seen = new Set<string>();
  for (const part of parts) {
    if (!part) continue;
    const normalized = normalizeSearch(String(part));
    if (normalized) seen.add(normalized);
  }
  return [...seen].join(" ");
}

/**
 * Termes d'une saisie, pour un filtrage côté navigateur.
 *
 * Chaque mot doit se retrouver dans la ligne, dans n'importe quel ordre :
 * « atlas casa » trouve « Atlas Distribution SARL » domiciliée à Casablanca.
 */
export function searchTerms(query: string): string[] {
  return normalizeSearch(query).split(" ").filter(Boolean);
}

/** La ligne correspond-elle à tous les termes ? */
export function matchesTerms(searchKey: string, terms: string[]): boolean {
  return terms.every((term) => searchKey.includes(term));
}

/**
 * Rang d'affichage d'un résultat, du plus pertinent au moins.
 *
 * Taper « M » doit d'abord donner les dossiers dont le nom **commence** par M —
 * c'est ce qu'on attend d'un annuaire — avant ceux qui contiennent un m ailleurs
 * ou dont seul le numéro correspond.
 */
export function matchRank(label: string, searchKey: string, terms: string[]): number {
  if (terms.length === 0) return 3;
  const name = normalizeSearch(label);
  const first = terms[0] ?? "";

  if (name.startsWith(first)) return 0;
  if (name.split(" ").some((word) => word.startsWith(first))) return 1;
  if (name.includes(first)) return 2;
  return searchKey.includes(first) ? 3 : 4;
}

/* --------------------------------------------------------------------------
   Clés par table
   -------------------------------------------------------------------------- */

/** Contenu d'une colonne JSON, réduit à ses valeurs. */
function jsonValues(raw: unknown): string {
  if (typeof raw !== "string" || raw.length === 0) return "";
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? JSON.stringify(parsed).replace(/["{}[\],:]/g, " ") : "";
  } catch {
    return "";
  }
}

const text = (value: unknown) => (typeof value === "string" ? value : "");

/**
 * Clé de recherche d'un dossier.
 *
 * Définie **ici et nulle part ailleurs** : le service et le remplissage de la
 * graine s'en servent tous les deux, et deux définitions auraient produit deux
 * clés — c'est exactement ce qui rendait une CIN d'associé introuvable après
 * remplissage alors qu'elle l'était après modification.
 *
 * Les listes JSON sont incluses : on retrouve ainsi un dossier par le nom d'un
 * gérant, la CIN d'un associé, un numéro de succursale ou une activité déclarée.
 */
export function clientSearchKey(row: Record<string, unknown>): string {
  return buildSearchKey(
    text(row.legalName),
    text(row.tradeName),
    text(row.subtypeOther),
    text(row.ice),
    text(row.if),
    text(row.rc),
    text(row.rcCourt),
    text(row.taxProfNo),
    text(row.managerCin),
    text(row.managerName),
    text(row.cnssNo),
    text(row.cnssRegNo),
    text(row.authorizationNo),
    text(row.phone),
    text(row.email),
    text(row.city),
    jsonValues(row.taxProfNos),
    jsonValues(row.branches),
    jsonValues(row.registrations),
    jsonValues(row.declaredActivities),
    jsonValues(row.partners),
    jsonValues(row.articles),
  );
}

export function deadlineSearchKey(row: { label?: string | null; periodLabel?: string | null }): string {
  return buildSearchKey(row.label, row.periodLabel);
}

export function documentSearchKey(row: { filename?: string | null; notes?: string | null }): string {
  return buildSearchKey(row.filename, row.notes);
}
