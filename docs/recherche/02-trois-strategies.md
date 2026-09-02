# LES TROIS STRATÉGIES INDÉPENDANTES (2 septembre 2026)



---

# STRATÉGIE A-produit-MVP

# Direct Conseil — MVP et feuille de route produit (gestion de cabinet comptable, Maroc)

*Base : digest de recherche du 1-2/09/2026 et fichier de vérification (les lignes CORRIGÉ priment ; les points NON VÉRIFIÉ sont marqués « à confirmer » ; mes ajouts sont marqués « hypothèse »).*

## 1. Personas et jobs-to-be-done

| Persona | Contexte (sourcé) | Top jobs-to-be-done |
|---|---|---|
| **Gérant de fiduciaire / comptable agréé (1-5 personnes)** — cœur de cible | ~3 900 comptables agréés régularisés (loi 127-12/53-19) + fiduciaires non ordinales ; « un fichier Excel par client », dossiers papier, pièces reçues par WhatsApp ; forfait mensuel 500-1 500 DH TPE ; logiciels actuels KHABIR/Sage sans CRM ni honoraires | 1) Savoir en 5 secondes quels dossiers sont en retard (pénalités art. 184/208 = perte de client). 2) Ne plus perdre de pièces (art. 211 CGI : 10 ans, perte à déclarer sous 15 jours). 3) Encaisser ses honoraires (notes d'honoraires informelles, impayés non chiffrés). 4) Savoir quels dossiers sont rentables et quel collaborateur est saturé. 5) Survivre au turnover (passation de dossier). |
| **Comptable employé / chef de mission** | Salaire 4 000-10 000 DH/mois ; portefeuille de dossiers ; pics le 10 (CNSS), fin de mois (TVA), janvier-mars (bilans, TP) ; jusqu'à 20 % du temps à chercher une facture | 1) Voir « ma semaine » : échéances de mes dossiers, pièces manquantes. 2) Relancer le client sans y passer une heure (WhatsApp/SMS en darija). 3) Prouver le dépôt (accusé SIMPL/Damancom rangé au bon endroit). 4) Retrouver les accès portails d'un client sans appeler le gérant. |
| **Client final : TPE SARL/SARL AU, auto-entrepreneur, CPU, association, particulier** | 109 656 créations en 2025 (SARL AU 64,7 %), 463 000 AE dont ~17 % déclarent ; reproches : « pas de visibilité », « retards fiscaux », « tarifs flous » | 1) Envoyer ses factures en photo depuis le téléphone. 2) Savoir s'il est « en règle » et combien il doit (honoraires, impôts). 3) Récupérer une attestation (régularité fiscale, CNSS) rapidement. 4) Comprendre en darija. |

## 2. Périmètre MVP (build 3-4 mois)

Principe : Direct Conseil est une couche « gestion de cabinet » (CRM + obligations + GED + honoraires + pilotage), pas un logiciel comptable. Tout ce qui suit est du MVP ; le reste est en V2/V3.

### 2.1 Rôles et permissions

| Rôle | Fiches client | Documents | Obligations | Honoraires | Coffre accès portails | Admin |
|---|---|---|---|---|---|---|
| Admin (gérant, EC/CA signataire) | tout | tout | tout | tout | lecture + écriture | utilisateurs, règles, facturation Direct Conseil |
| Chef de mission | tout | tout | valide « déclaré/payé » | lecture | lecture (journalisée) | non |
| Collaborateur | son portefeuille | son portefeuille | marque « déclaré » avec preuve | lecture de ses dossiers | lecture sur ses dossiers (journalisée) | non |
| Aide-comptable / stagiaire | lecture | upload + classement | lecture | aucun | aucun | non |
| Client (V2) | sa fiche | ses documents | statut de ses obligations | ses factures | aucun | non |

Chaque dossier porte un **responsable** et un **réviseur**. Tout accès au coffre d'accès portails et toute modification d'une fiche sont journalisés (art. 24-g loi 09-08). Désactiver un collaborateur génère une **fiche de passation** automatique (dossiers, accès, particularités, échéances ouvertes).

### 2.2 Fiche client et recherche

Recherche instantanée (une barre, résultats en < 200 ms — hypothèse technique) par **nom, ICE, IF, CIN du gérant, RC, téléphone**. Typologie à deux niveaux, calquée sur la nomenclature DGI :

- **Personne morale** : SARL, SARL AU, SA, SAS, SNC, succursale, GIE, association, coopérative, syndicat de copropriété.
- **Personne physique** : auto-entrepreneur, CPU, RNS, RNR (dont profession libérale), particulier (salarié multi-employeurs, foncier, immobilier, capitaux mobiliers).

### 2.3 Modèle de données par type de client

**Champs communs** : dénomination/nom, type et sous-type, adresse, téléphone WhatsApp, e-mail, **adresse électronique déclarée à la DGI (obligatoire LF 2026, art. 145-X)**, date de début d'activité, date de clôture d'exercice, responsable, réviseur, statut du dossier (prospect / onboarding / actif / suspendu pour impayé / résilié / archivé), date d'entrée, canal d'acquisition.

**Identifiants avec validation** :

| Identifiant | Validation | Types concernés |
|---|---|---|
| ICE | 15 chiffres ; contrôle modulo 97 **à confirmer** (NON VÉRIFIÉ 2.7) — implémenter la longueur, activer la clé après confirmation | PM, professionnels, AE |
| IF | numérique, obligatoire | tous |
| RC + tribunal | numérique + liste des tribunaux | sociétés, commerçants |
| N° taxe professionnelle | 8 chiffres **à confirmer** (2.6) | professionnels |
| N° affiliation CNSS | numérique ; n° d'immatriculation par salarié | employeurs |
| CIN gérant / associés / bureau | format alphanumérique marocain ; **donnée sensible CNDP** | tous |
| N° AE | selon RNAE | AE |
| N° et date du récépissé (provisoire/définitif à 60 jours) | date | associations |
| N° registre des coopératives (greffe TPI ; l'agrément ODCO n'existe plus — CORRIGÉ 3.5) | texte | coopératives |

**Attributs de régime** (pilotent le moteur) : régime TVA (mensuel si CA taxable N-1 ≥ 1 MDH, trimestriel sinon, nouveaux assujettis trimestriels ; option mensuelle avant le 31 janvier ; exonéré) ; régime IS/IR (IS, RNR, RNS, CPU, AE) ; option paiement CPU (annuel ou 4 acomptes) ; périodicité AE (mensuelle/trimestrielle) ; employeur oui/non ; date de première embauche ; exonération TP 5 ans et CM 36 mois (calculées depuis le début d'activité) ; CA N-1 (seuils TVA, RNS/CPU 2 M / 500 k, AE 500 k / 200 k, loi 69-21 > 2 MDH, CAC > 50 MDH) ; domicilié oui/non ; bénéfice ≥ 1 MDH (CSS).

**Checklist documentaire par sous-type**, chaque pièce avec date d'expiration et alerte : CIN (validité), statuts, PV, certificat négatif (validité 3 mois ou 1 an — **à confirmer** 2.17), modèle J, bail ou contrat de domiciliation, attestation TP, attestation d'affiliation CNSS, lettre de mission signée, attestation de régularité fiscale (**< 6 mois** pour éviter la RAS TVA 100 %), récépissé d'association, PV d'AG de nomination du syndic, carte AE. Un identifiant ou une pièce obligatoire manquante s'affiche en rouge sur la fiche.

**Accès portails et mandats** : sous-objet chiffré par client — SIMPL (identifiant utilisateur, formulaires d'adhésion ADC920/930/940 archivés — **à confirmer** 2.14), DAMANCOM (personne physique porteuse du Mon e-ID, date de délégation — **à confirmer** 2.12), depotbilan, rn.ae.gov.ma. Mots de passe stockés uniquement dans un coffre chiffré (chiffrement applicatif, clé séparée), révélation à la demande, journalisée ; jamais en clair, jamais dans les exports.

### 2.4 Gestion documentaire

- Upload web (drag & drop, multi-fichiers), **scan mobile** (PWA : photo → recadrage → PDF), import par lot (clé USB/dossier zip) à l'onboarding.
- Rattachement obligatoire à un client ; catégories (constitutif, fiscal, social, juridique, honoraires, pièces mensuelles achat/vente/banque/caisse), exercice, mois.
- **Versions** (nouvelle version d'un document, l'ancienne reste), **hash SHA-256 + horodatage serveur + auteur** à chaque upload (loi 53-05 : intégrité = valeur probante ; horodatage qualifié loi 43-20 en V2).
- Rétention 10 ans par défaut sur les pièces comptables et fiscales, purge configurable ailleurs (art. 3-e loi 09-08).
- **Registre des pertes** : bouton « document perdu » qui génère la LRAR type à l'inspecteur (15 jours, art. 211).
- Export complet du dossier client en zip (changement de cabinet, contrôle fiscal).
- OCR : **non** en MVP (voir §4) ; on prépare seulement le champ « texte extrait » et la file de traitement.

### 2.5 Moteur d'obligations et d'échéances

**Architecture** : les règles vivent dans une **table éditable** (pas dans le code), versionnée par année fiscale (LF 2025, LF 2026, LF 2027), avec date d'effet et source (article). Chaque règle = *conditions* (sous-type, régime, employeur, seuils) + *fréquence* + *formule de date* + *portail* + *preuve attendue* + *formule de pénalité*.

**Trois formules de date** : (a) date fixe « avant le X » = X-1 à 23h59 ; (b) « fin du N-ième mois après ouverture/clôture d'exercice » ; (c) « N jours après un événement ». Puis application de l'**art. 163 CGI** : jour de départ non compté, report au premier jour ouvrable si le délai expire un jour férié ou chômé légal (exemple DGI 2026 : 1er mars → 2 mars). Calendrier des fériés fixes + religieux mobiles saisi chaque année par l'admin. **Samedi : non tranché** (à confirmer) → paramètre « traiter le samedi comme chômé : oui/non », défaut non.

**Règles MVP (versions corrigées)** :

| Obligation | Déclencheur | Échéance | Preuve | Pénalité estimée |
|---|---|---|---|---|
| TVA mensuelle | régime mensuel | dernier jour du mois suivant (télédéclaration, art. 110) | accusé SIMPL-TVA | art. 184 : 5 % (≤ 30 j) / 15 % / 20 %, min 500 DH ; art. 208 : **20 %** + 5 % + 0,5 %/mois |
| TVA trimestrielle | régime trimestriel | 30/04, 31/07, 31/10, 31/01 | idem | idem |
| Acomptes IS 25 % | société IS (hors 36 premiers mois pour la CM) | fin des 3e/6e/9e/12e mois **après ouverture de l'exercice** (31/03… seulement si exercice civil) | accusé SIMPL-IS | art. 208 : 10 % (5 % ≤ 30 j) + 5 % + 0,5 %/mois |
| Liasse + solde IS + CSS | société IS | 3 mois après clôture (31/03 si civil) | accusé | art. 184 + 208 |
| Dispense d'acomptes | société IS | J-15 avant chaque acompte (alerte info) | — | — |
| CM IR | RNR/RNS | avant le 1er février (= 31/01) | accusé | art. 208 |
| IR RNR/RNS + état des ventes ICE + rémunérations tiers | RNR/RNS | avant le 1er mai (= 30/04) | accusé SIMPL-IR | art. 184 |
| IR revenus non professionnels (foncier, multi-salaires) | particulier | avant le 1er mars (= 28-29/02) | accusé | art. 184 |
| État 9421 (traitements et salaires) | employeur | avant le 1er mars | accusé | art. 184/200 |
| IR salaires (retenue) | employeur | fin du mois suivant | accusé | art. 208 : 20 % |
| CPU déclaration + paiement | CPU | avant le 1er avril (= 31/03) ou 4 acomptes fin 3e/6e/9e/12e mois | accusé SIMPL-CPU | art. 184/208 |
| Auto-entrepreneur | AE | avant la fin du mois suivant le mois/trimestre ; CA nul aussi (**à confirmer**) | reçu RNAE | 100 DH min (art. 184) ; alerte « dormant » si 2 trimestres sans déclaration (hypothèse) |
| CNSS BDS + paiement | employeur | avant le 10 du mois suivant (**source secondaire, à confirmer**) | reçu DAMANCOM | 3 % + 0,5 %/mois (AMO 1 %/mois) depuis 1/04/2025 |
| Taxe professionnelle : déclaration éléments | professionnel avec changements | 31 janvier N+1 | récépissé | 15 %, min 500 DH |
| TP : inscription / cessation | événement | 30 jours / 45 jours | attestation | 15 %, min 500 DH |
| AGO + dépôt des états de synthèse | SARL / SA | AGO ≤ 6 mois après clôture ; dépôt 30 jours (SARL) / 2 mois (SA) après l'AGO saisie | reçu depotbilan | amende loi 5-96 / 17-95 |
| Enregistrement d'actes | événement (bail, cession, PV) | 30 jours de l'acte | quittance | art. 184/208 |
| Inscription modificative RC / bénéficiaires effectifs | événement | dans le mois | récépissé | 1 000-5 000 DH / 5 000-50 000 DH |
| Association : modification bureau/statuts | événement | dans le mois | récépissé | — |
| Domiciliation : liste des domiciliés | fiduciaire domiciliataire | avant le 31 janvier | copie | 10 000-20 000 DH |
| Loi 69-21 délais de paiement | CA > 2 MDH | trimestriel, fin du mois suivant | accusé | 5 000 DH et plus selon CA |
| Facturation électronique | tous | **statut « veille »**, pas de date (décret non publié) | — | non fixée |

**Statuts** : *à faire* (gris) → *à venir* (orange, J-15/J-7/J-1 paramétrables) → *en retard* (rouge : échéance dépassée sans preuve) → *déclaré* (preuve attachée ou case cochée par le collaborateur, validée par le chef de mission) → *payé* (reçu de paiement) → *non applicable* (justification obligatoire, ex. exonération). Chaque obligation porte un responsable, la preuve, et le **coût estimé du retard** calculé par la formule de la règle sur un montant saisi ou estimé (les formules ci-dessus, en indiquant « estimation, hors majorations de recouvrement »). Un « mode panne SIMPL/Damancom » horodate les tentatives et captures pour contester une pénalité.

**Alertes de bascule** (calculées sur le CA saisi) : TVA mensuelle à 1 MDH, RNS/CPU 2 M / 500 k, AE 500 k / 200 k et 80 000 DH par client (RAS 30 %), compteur d'années consécutives de dépassement (2 = changement de régime), fin d'exonération TP (5 ans) et CM (36 mois).

### 2.6 Honoraires et encaissements

- **Lettre de mission** générée depuis un modèle (mission, calendrier, honoraires, TVA 20 %), signature simple horodatée (une signature manuscrite scannée n'a pas de valeur : on l'indique, signature qualifiée en V2).
- **Facturation récurrente** : abonnement mensuel/annuel par client, actes ponctuels (création, domiciliation, bulletin de paie, bilan), facture conforme (ICE, IF, TVA 20 %), numérotation séquentielle, PDF. Structure de données déjà compatible UBL 2.1 pour l'e-facture future.
- **Encaissements** : espèces, chèque, virement, avec date ; **balance âgée** ; client en **rouge** dès 1 facture échue (seuil paramétrable) ; relances en 3 temps par WhatsApp/SMS (templates FR/darija, opt-out enregistré) ; option « suspendre les livrables non urgents » au-delà de X mois d'impayé.

### 2.7 Tâches et workflow

Tâches auto-créées par le moteur (une par obligation) + tâches manuelles ; vue « ma semaine » par collaborateur ; checklist mensuelle « pièces reçues → saisie → déclaré » par client ; **timer léger** par dossier (start/stop ou saisie d'heures) pour alimenter la marge. Pas de Kanban complexe en MVP.

### 2.8 Dashboard (KPIs et calcul)

| KPI | Calcul |
|---|---|
| Nouveaux clients du mois (par sous-type, par canal) | count(date d'entrée ∈ mois) |
| Dossiers en retard / à jour | clients ayant ≥ 1 obligation rouge vs zéro |
| Obligations rouges et oranges de la semaine, par responsable | somme par statut et par collaborateur |
| Taux de dépôt à temps (30/90 jours) | déclarées avant échéance / obligations dues |
| Honoraires facturés vs encaissés, impayés (30/60/90 j) | sommes des factures et encaissements |
| Revenu par client | honoraires encaissés sur 12 mois glissants |
| **Bénéfice par client** | honoraires encaissés − Σ(heures saisies × coût horaire du collaborateur) ; coût horaire = (salaire brut chargé mensuel ÷ heures productives/mois, défaut 140 h — hypothèse) ; paramétré par utilisateur par l'admin ; comparé aux fourchettes de marché (AE 300-1 000, TPE 600-5 000, PME 5 000-15 000 DH/mois) pour signaler les dossiers à repricer |
| Charge de travail | dossiers actifs et obligations ouvertes par collaborateur ; heures saisies vs capacité |
| Taux de collecte des pièces | checklists mensuelles complètes / attendues |
| Clients à risque de bascule | seuils §2.5 |

## 3. V2 et V3

| Version (horizon) | Fonctionnalité | Rationale |
|---|---|---|
| **V2 (mois 5-9)** | Portail/app client FR/AR/darija : dépôt de pièces, statut des obligations, factures, paiement (CMI ou YouCan Pay) | Répond au reproche n°1 des dirigeants (« pilotage à l'aveugle ») ; seuls les cabinets en ligne l'offrent |
| V2 | Collecte WhatsApp Business API : reconnaissance de l'expéditeur, classement par mois/type, relances auto | WhatsApp est le canal réel ; utilitaire ≈ 0,0046 $/msg ; nécessite vérification Meta et opt-in CNDP |
| V2 | OCR auto-hébergé (PaddleOCR/Tesseract, FR/AR) : CIN, ICE/IF, montants ; recherche plein texte | Angle Experio ; hébergé au Maroc pour éviter le transfert art. 43-44 |
| V2 | Import CSV/Excel des clients et des balances depuis KHABIR/Sage/EBP ; générateurs eBDS Damancom, XML état 9421, relevé de déductions TVA | Interopérabilité sans refaire la production comptable ; formats exacts à confirmer |
| V2 | Score de conformité client 0-100 ; simulateur de pénalités envoyé au client | Transforme l'alerte en argument commercial |
| V2 | Kit CNDP pré-rempli et DPA signé électroniquement dans l'onboarding | Chaque cabinet est responsable de traitement ; argument de confiance |
| V2 | Signature qualifiée via Barid eSign (PSCo, loi 43-20) pour lettres de mission et PV | Valeur probante des actes ; prix à confirmer |
| **V3 (mois 10-18)** | Connecteur facturation électronique (UBL 2.1, clearance DGI) pour les honoraires du cabinet et « radar e-facture » par client | À lancer seulement après publication du décret ; le cabinet sera prescripteur |
| V3 | Module contrôle fiscal : compte à rebours 15/30/60 jours, export FEC (art. 145-I), dossier de réponse | 82 017 contrôles sur pièces en 2025 |
| V3 | Workflow attestations (régularité fiscale, CNSS) avec rappel à 6 mois | Lie la RAS TVA 75/100 % à un actif suivi |
| V3 | Import relevés bancaires PDF/CSV + rapprochement basique | Substitut à l'open banking absent |
| V3 | Assistant IA sur CGI 2026 avec citations, réservé au cabinet | Risque de conseil erroné maîtrisé ; hébergement/IA à traiter côté CNDP |
| V3 | Multi-cabinet / marque blanche, API partenaires (Charikaty, banques) | Apporteurs de dossiers |

## 4. Ce qu'on ne construit pas (et pourquoi)

1. **Pas de moteur comptable** (saisie d'écritures, grand-livre, liasse) : Sage/KHABIR/AGL/Odoo le font, les cabinets y sont attachés, et cela déclencherait le cahier des charges CNC (FEC, clôture). On importe/exporte.
2. **Pas de synchronisation bancaire** : open banking non réglementé, aucune API bancaire publique. Import fichier seulement (V3).
3. **Pas de télédéclaration automatique SIMPL/DAMANCOM** : aucune API publique, géo-blocage Damancom, Mon e-ID personnel. On fait des « connecteurs humains » (checklist + preuve).
4. **Pas de paie complète** : Humantal, Mizan, OJRA existent ; paie = point faible même d'Odoo. Au plus un export eBDS en V2.
5. **Pas de dates ni de sanctions e-facture codées en dur** : rien d'officiel au BO ; statut « veille » uniquement.
6. **Pas d'OCR cloud US/EU par défaut** : envoi de CIN à l'étranger = transfert art. 43-44.
7. **Pas de stockage des mots de passe portails en clair ni de robot de connexion** : risque juridique et de blocage de comptes.
8. **Pas de conseil fiscal ni de « certification »** dans le produit ou le marketing : monopole OEC (loi 15-89), outil et non prestataire.
9. **Pas de gestion de projet lourde** (Gantt, pipelines multi-étapes) : équipes de 1-5 personnes.

## 5. Principes UX

- **Interface cabinet en français**, terminologie DGI/CNSS (SIMPL, BDS, liasse) ; **côté client en arabe et darija** (notifications, portail V2), FR en option.
- **Recherche au clavier** : Ctrl+K partout, résultats en tapant, navigation clavier dans la fiche ; un dossier s'ouvre en une frappe.
- **Rouge signifie action** : couleur réservée au retard et à l'impayé ; jamais de rouge décoratif.
- **Mobile pour scanner, desktop pour travailler** : PWA légère (< 1 Mo initial — hypothèse), photos compressées côté client, upload reprenable ; le web fonctionne en 3G.
- **Faible bande passante** : pages serveur légères, pas de dashboard chargé en temps réel, listes paginées, PDF générés à la demande.
- **Onboarding en une heure** : import Excel des clients (nom, forme, ICE, IF, RC, CNSS, régime TVA, honoraires), puis checklist de scan par dossier.
- **Preuve avant vert** : l'interface demande l'accusé au moment du clic « déclaré ».
- **Support WhatsApp** aux heures de pic (les 10 et fin de mois, mars-avril).

## 6. Plan de construction

**Stack (hypothèse, optimisée pour un petit budget et un hébergement marocain)** : monolithe web — backend Python (Django) ou Node (NestJS), PostgreSQL, stockage objet S3-compatible (MinIO) sur le même hébergeur, Redis pour les files (alertes, PDF), frontend React/Vue en PWA, envoi SMS AdaSMS (0,30-0,49 DH HT), WhatsApp via BSP (360dialog ou Wasel en MAD) en V2. Règles d'obligations en table + moteur de dates testé unitairement sur le calendrier 2026 (cas 2 mars, 30 avril, 1er mai férié).

**Hébergement** : **Maroc par défaut** — VPS locaux 539-879 DH/mois (vps.ma) pour le MVP, migration vers inwi Business / N+ONE (Oracle Cloud Casablanca) / Atlas Cloud Services à la traction. Conséquence CNDP : rester au Maroc évite toute autorisation de transfert (F118) ; un hébergeur UE imposerait au minimum une notification/autorisation (liste des pays adéquats non publiée — **à confirmer**), un cloud US est exclu. Chaque sous-traitant (e-mail, SMS, OCR) est listé dans le DPA avec sa localisation.

**Sécurité** : MFA (TOTP) obligatoire pour admin et chef de mission, recommandée pour tous ; chiffrement TLS + disque + chiffrement applicatif du coffre d'accès ; journal d'audit immuable (qui a vu/modifié quelle fiche, quand) ; sauvegardes chiffrées quotidiennes hors site (second datacenter marocain), test de restauration mensuel ; rétention 10 ans ; procédure d'incident écrite ; export complet des données du cabinet.

**Conformité** : SARL (capital 1 DH, 7 600-16 430 DH de frais, IS 20 %) ; déclaration CNDP de l'éditeur (F211) au lancement ; kit CNDP pour les cabinets (présence de CIN → autorisation préalable art. 12-1-e, **à confirmer auprès de la CNDP**, une dispense sectorielle pouvant exister) ; DPA dans les CGV ; opt-in/opt-out pour toute communication.

**Équipe et coût pour un fondateur non comptable (hypothèse)** :

| Poste | Durée | Coût indicatif |
|---|---|---|
| 1 développeur full-stack senior (freelance ou associé technique) | 4 mois | 60 000-100 000 DH (ou equity) |
| 1 développeur junior/front | 4 mois | 30 000-45 000 DH |
| Expert-comptable ou comptable agréé référent (mission de validation des règles, 2-3 jours/mois) | 4 mois | 15 000-30 000 DH |
| Designer UX (2 semaines) | ponctuel | 10 000-15 000 DH |
| Hébergement, SMS, domaine, outils | 4 mois | 5 000-8 000 DH |
| Juridique (SARL, CGV/DPA, CNDP) | ponctuel | 15 000-25 000 DH |
| **Total MVP** | | **≈ 135 000-225 000 DH** |

Financement : Innov Invest Tech Start (≤ 200 000 DH à 0 %) puis Tech Boost ; Startup VB ; Technopark (50 DH/m²).

**Validation métier** :
1. **Comité pilote de 5-10 cabinets** (Casablanca et Rabat, fiduciaires de 1-5 personnes et comptables agréés récemment régularisés) : entretiens avant le build (impayés, dossiers par collaborateur, formats SIMPL/Damancom réels), accès gratuit 6 mois contre feedback hebdomadaire et cas de test.
2. **Table de règles revue par l'expert-comptable référent** avant activation ; chaque règle porte source, article, statut (vérifié / à confirmer) ; les points ouverts (CNSS le 10, samedi, dividendes par date de distribution vs exercice d'origine — les deux lectures existent dans la vérification, à trancher sur le CGI 2026 art. 247-XXXVII-C) sont marqués visibles pour l'admin.
3. **Changelog réglementaire** public dans l'application : chaque changement de règle (LF, note circulaire, communiqué DGI) est daté, sourcé et notifié aux cabinets ; le cabinet peut surcharger localement une règle sans attendre une mise à jour.
4. Roadmap V2/V3 arbitrée avec le comité (vote par valeur/effort).

**Jalons** : M1 modèle de données, fiche client, recherche, rôles ; M2 GED, moteur de règles + calendrier 2026, statuts ; M3 honoraires, tâches, dashboard ; M4 import Excel, alertes SMS, sécurité, tests avec les pilotes ; lancement payant à M5 avec grille publique (Solo 199 / Cabinet 449 / Pro 899 DH HT/mois).

## 7. Risques et mitigations

| Risque | Impact | Mitigation |
|---|---|---|
| Règle d'échéance fausse → pénalité chez un client → perte de confiance | Très élevé | Table de règles sourcée, revue par expert-comptable, statut « à confirmer » visible, tests unitaires sur le calendrier, avertissement « outil d'aide, le cabinet reste responsable » dans les CGV |
| Points réglementaires non tranchés (CNSS 10/15, samedi, e-facture, F112) | Élevé | Paramètres par cabinet, changelog, veille mensuelle tax.gov.ma/cnss.ma/BO, expert référent |
| CNDP : CIN et hébergement | Élevé (sanctions pénales, amendes doublées pour PM) | Hébergement Maroc, F211 dès le lancement, kit CNDP pour les cabinets, DPA, chiffrement, pas de sous-traitant étranger caché |
| Cabinets sans titre (fiduciaires non ordinales) clientes du SaaS | Moyen (image, exercice illégal) | CGV : l'utilisateur atteste de son droit d'exercer ; marketing centré sur comptables agréés et EC ; à valider avec un avocat |
| Concurrence (FIDUCIO, ComptaPlus, Experio, ExpertC, Oasis/Odoo) | Moyen | Différenciation : fiche + obligations + GED + honoraires en un seul outil, prix publics en MAD, hébergement Maroc, darija |
| Adoption faible (Excel + WhatsApp « gratuits ») | Élevé | Onboarding en 1 h par import, pilote gratuit, argument « rouge = pénalité évitée », dossier MOWAKABA (éligibilité OPEX **à confirmer**) |
| Sécurité du coffre d'accès portails | Très élevé | Chiffrement applicatif séparé, MFA, révélation journalisée, aucun robot de connexion ; option « ne pas stocker » |
| Dépendance à un développeur unique | Élevé | Code documenté, associé technique ou deux freelances, sauvegardes de dépôt, tests automatisés du moteur |
| Fondateur non comptable | Moyen | Expert référent rémunéré, comité pilote, ne jamais coder une règle sans source |
| Pics de charge (10, fin de mois, 31/03) et pannes SIMPL | Moyen | Alertes anticipées J-15/J-7, mode panne horodaté, support WhatsApp aux heures de pic |
| Facturation électronique décrétée avec délai court | Moyen | Données de facture déjà structurées UBL, veille décret, partenariat possible avec Hisab/Facturis |


---

# STRATÉGIE B-differenciation

# Direct Conseil — Vision produit « 10x » pour la gestion de cabinet comptable au Maroc

*Document de stratégie produit, 2 septembre 2026. Base : digest de recherche + fichier de vérification (les corrections CORRIGÉ priment ; les points NON VÉRIFIÉ sont marqués « à confirmer » ; mes propres ajouts sont marqués « hypothèse »).*

---

## 1. La thèse : un seul écran de vérité par client, et zéro pénalité oubliée

Aujourd'hui un cabinet marocain vit dans quatre outils qui ne se parlent pas : **Excel** (un fichier par client), **le papier** (dossiers physiques, 10 ans de conservation art. 211 CGI), **WhatsApp** (canal réel de réception des pièces, « jusqu'à 20 % du temps » à chercher une facture) et **Sage/KHABIR** (production comptable, interface « 2005-2010 », ni honoraires, ni CRM, ni temps passé). Le segment « gestion de cabinet » est **quasi vide** au Maroc : ExpertC (60-80 DH/utilisateur/mois) n'a ni GED ni obligations ; Experio (3 000+ utilisateurs, partenaire OEC) fait de l'OCR/pré-compta sans fiche client ni honoraires ; Fiducio/ComptaPlus n'ont aucune traction démontrable ; Kabineo (France) a exactement l'idée mais aucune localisation DGI/CNSS.

**Le « 10x » de Direct Conseil ne vient pas d'une fonctionnalité mais d'une chaîne fermée** : *pièce reçue → classée dans le bon dossier → obligation générée par le régime du client → passée au vert uniquement avec preuve de dépôt → honoraires facturés et encaissés → marge et charge visibles au dashboard.* Aucun outil marocain ne ferme cette boucle. Et Direct Conseil **n'est pas un logiciel comptable** : il ne concurrence pas Sage/KHABIR sur l'écriture, il s'y branche (import/export), ce qui évite le cahier des charges CNC (FEC, clôture) tant qu'aucune écriture n'est saisie.

Promesse marketing en une ligne : **« Plus rien ne se perd, plus rien n'est en retard, et vous savez enfin ce que chaque client vous rapporte. »**

Trois vérités du marché fixent l'ordre des priorités :
1. **La douleur n°1 est la pénalité automatique** : art. 184 CGI (5 % ≤ 30 j, 15 % au-delà, 20 % taxation d'office, min. 500 DH), art. 208 (10 %, ou 5 % si ≤ 30 j, **20 % pour TVA et retenues à la source**, + 5 % le 1er mois + 0,5 %/mois), CNSS **3 % + 0,5 %/mois depuis avril 2025** (AMO 1 %/mois — corrigé, ce n'est plus 1 %). Les pannes SIMPL du 30/04/2025 et DAMANCOM du 01/07/2025 ont produit des pénalités « sans distinction ».
2. **Le cœur de cible n'est pas l'expert-comptable** (867 membres OEC en exercice, déjà sur Sage Expert) mais les **~3 900 comptables agréés** récemment régularisés et les fiduciaires de 1 à 5 personnes (« plus de 4 000 » selon un chiffre vendeur non sourcé — à confirmer). Marché adressable ≈ 5 000-8 000 structures, dont 88 % des EC et 46 % des CA à Casablanca-Rabat.
3. **Le contrôle fiscal est devenu massif et automatisé** : 82 017 contrôles sur pièces en 2025 (+35 %). Un dossier probant (hash, horodatage, 10 ans) devient un actif.

---

## 2. Les axes candidats, validés ou rejetés contre la recherche

Légende effort : S (< 1 mois-homme), M (1-3), L (> 3). Priorité : **now** (MVP, 0-6 mois), **next** (6-12), **later** (12-24).

### 2.1 Le socle (now) — ce sans quoi rien ne marche

| Axe | Verdict | Problème → Fonctionnalité | Pourquoi ça gagne au Maroc | Effort | Dépendances / risque | Prio |
|---|---|---|---|---|---|---|
| **Fiche client 360 + dossier permanent numérique** | VALIDÉ | Un Excel par client, pièces perdues → fiche typée à deux niveaux (PM : SARL/SARL AU/SA/SAS/SNC/succursale/GIE/association/coopérative/syndic ; PP : AE/CPU/RNR-RNS/particulier), identifiants validés (ICE 15 chiffres mod 97 — à confirmer, IF, RC + tribunal, TP 8 chiffres, CNSS, CIN, n° AE, récépissé association, registre ODCO), checklist de documents constitutifs par sous-type avec **dates de validité** (certificat négatif, bail, CIN, attestation de régularité), recherche instantanée par nom/ICE/IF. | La nomenclature est exactement celle de la DGI (SARL AU = 64,7 % des créations 2025, 463 383 AE, 65 000+ coopératives). Un identifiant manquant sur facture = charge et TVA non déductibles : l'afficher en rouge est un argument client immédiat. | M | Import CSV depuis Excel en < 10 min (onboarding terrain). Risque CNDP : la fiche contient des CIN → autorisation préalable F112 par cabinet (à confirmer, lot 6 non vérifié). | now |
| **Moteur d'obligations + statut rouge/orange/vert + preuve de dépôt** | VALIDÉ (cœur) | Échéances gérées de tête → moteur de règles paramétré par sous-type, régime TVA (mensuel si CA N-1 ≥ 1 MDH), employeur ou non, date d'ouverture d'exercice, CSS (bénéfice ≥ 1 MDH), loi 69-21 (CA > 2 MDH), domicilié ou non. Règles codées correctement : art. 163 (jour de départ exclu, report au 1er jour ouvrable — 2 mars 2026 pour un 28 février samedi) ; « avant le 1er X » = X-1 ; acomptes IS « fin des 3e/6e/9e/12e mois **suivant l'ouverture** » (pas 31/03 en dur) ; TVA télédéclarée **fin du mois suivant** (le « avant le 20 » ne vaut que pour le papier) ; IR non professionnel avant le 1er mars, RNR/RNS avant le 1er mai, CPU avant le 1er avril ; CNSS le 10 (opérationnel, à confirmer sur texte). **ROUGE = dépassé sans accusé SIMPL/DAMANCOM rattaché ; VERT seulement avec preuve.** Coût du retard affiché (art. 184/208, CNSS). Table de taux **versionnée par LF** (2025/2026/2027) avec changelog réglementaire visible. | Personne au Maroc n'affiche un statut par obligation par client. Le calendrier change chaque 1er janvier (dividendes 11,25 % en 2026, RAS TVA/IS par paliers 500/350/200 MDH). Les preuves conservées 10 ans servent à contester une pénalité. | M | Jours fériés religieux saisis chaque année par l'admin. Divergences résiduelles (art. 151 rémunérations tiers, samedi non « chômé légal ») → délais modifiables par l'admin sans mise à jour logicielle. | now |
| **Collecte WhatsApp-first** | VALIDÉ | Pièces « en vrac, en retard, par WhatsApp/USB » → numéro WhatsApp Business du cabinet ; l'expéditeur est reconnu par son numéro lié à la fiche ; photo/PDF classé par client/mois ; checklist mensuelle (achats, ventes, relevés, caisse, paie) ; relances automatiques J+5/J+10 **en darija et en français** ; fallback e-mail et import en masse. Classification automatique par type = phase 2 (OCR). | WhatsApp est déjà le canal réel ; aucun concurrent local ne l'industrialise (Experio scanne mais ne relance pas). Coût utilitaire ≈ 0,0046 $/message (≈ 0,045 MAD, à confirmer). | M | Vérification Meta Business (RC, ICE, site, politique de confidentialité) ; BSP marocain facturant en MAD (Wasel) ou 360dialog ; opt-in/opt-out obligatoire (art. 9-10 et 59 loi 09-08). Question ouverte : les cabinets acceptent-ils qu'un tiers reçoive les pièces ? → à valider en 15-20 entretiens. | now |
| **Honoraires : lettre de mission, abonnement, impayés, relances** | VALIDÉ | « Notes d'honoraires HT » informelles, impayés non mesurés → lettre de mission générée (obligatoire pour EC, exigée par le projet de code de déontologie OPCA 2.23.150), abonnement mensuel en MAD + actes ponctuels (création 2 450-4 350 DH, bulletin 100-300 DH), facture conforme (ICE, TVA 20 %), balance âgée, relances WhatsApp/SMS en 3 temps, blocage configurable des livrables non urgents. | Facturation récurrente = norme des fiduciaires ; aucun outil local ne suit l'encaissement. | S | Encaissement : CMI (2-6 semaines) ou YouCan Pay pour démarrer. Facture du cabinet à préparer au format UBL 2.1 sans date promise. Taux d'impayés réel inconnu (à mesurer). | now |
| **Dashboard dirigeant + charge par collaborateur** | VALIDÉ | « Combien de dossiers sont à jour ? » sans réponse → nouveaux clients par mois et par canal, obligations rouges de la semaine, taux de dépôt à temps, honoraires facturés vs encaissés, marge par dossier (forfait − heures × coût horaire : 3 000-14 000 DH/mois de salaire), **dossiers actifs et obligations ouvertes par collaborateur**. | Présent chez Karbon/Canopy/Kabineo, absent de tous les outils marocains. Répond au vide total de données sur la charge par comptable. | S | Marge = estimation tant que le time tracking n'existe pas (hypothèse : temps standard par type de dossier saisi par l'admin). | now |
| **Rôles, journal d'audit, fiche de passation anti-turnover** | VALIDÉ | Départ d'un collaborateur = perte de savoir → rôles admin / chef de mission / comptable / aide-comptable / stagiaire, journal immuable (art. 24-g loi 09-08), **coffre des accès portails par client** (SIMPL, DAMANCOM Mon e-ID — qui porte l'e-ID, date d'activation —, depotbilan, rn.ae.gov.ma), fiche de passation générée à la désactivation d'un compte. | Douleur n°6 (multi-comptes, création utilisateur 48 h, géo-blocage) traitée par personne. Secret professionnel (art. 19 loi 15-89, à confirmer) exige la traçabilité. | S | **Ne jamais stocker les mots de passe en clair** ; chiffrement, MFA. Statut « tiers déclarant » SIMPL/DAMANCOM multi-clients : non vérifié. | now |
| **« Mode panne » SIMPL/DAMANCOM** | VALIDÉ (arme de différenciation) | Pénalités appliquées malgré un empêchement technique → bouton qui horodate les tentatives, stocke captures et messages d'erreur (« Votre compte est bloqué »), génère une réclamation type de remise de majorations (art. 236 CGI, hypothèse à faire valider par un fiscaliste). | Incidents documentés 30/04/2025 et 01/07/2025 ; l'OPCA a dû réclamer publiquement. Coût dérisoire, valeur émotionnelle maximale. | S | Aucune dépendance externe. Ne pas promettre l'issue de la réclamation. | now |
| **Hébergement au Maroc + kit CNDP** | VALIDÉ (argument de confiance) | Peur du cloud étranger, géo-blocage DAMANCOM → données chez inwi Business / N+ONE-Oracle Casablanca / Atlas Cloud (VPS local 539-879 DH/mois pour le MVP) ; DPA conforme art. 23-3 ; kit F211/F112 pré-rempli livré à l'onboarding ; rétention différenciée (10 ans pièces, purge du reste). | Héberger hors Maroc = transfert (art. 43-44, sanctions pénales). Aucun SaaS étranger ne peut dire « hébergé au Maroc, déclaré CNDP ». | S | Nomenclature exacte des formulaires et existence d'une dispense pour « tenue de comptabilité » : à confirmer auprès de la CNDP. Ne jamais prétendre à une « certification CNDP » (inexistante). | now |
| **Radar facturation électronique (veille)** | VALIDÉ en mode veille, REJETÉ en mode calendrier | Champ « CA » sur la fiche → drapeau « probablement concerné par la phase 1 (> 200 MDH, ~1 655 sociétés, chiffre non officiel) » ; bandeau « décret non publié au BO » ; alerte le jour de publication. | Le cabinet sera le prescripteur, mais **aucun seuil, aucune date, aucune sanction n'est officiel** (LF 2026 et NC 737 : zéro occurrence). Promettre 2027 serait une faute. | S | Suivre tax.gov.ma ; connecteur UBL 2.1/xHub uniquement quand la spécification existe. | now (veille) / later (connecteur) |
| **Suivi des attestations (régularité fiscale < 6 mois, CNSS)** | VALIDÉ | Attestation expirée = RAS TVA de **100 % au lieu de 75 %** (art. 117, attestation de moins de 6 mois, confirmé MEF) → workflow demande (SIMPL-Attestation, 5-10 j, à confirmer) / suivi / rappel d'expiration, attestation CNSS (validité 3 mois), blocage si une obligation rouge empêche la délivrance. | Avec l'extension LF 2026 aux grands donneurs d'ordre (juillet 2026 ≥ 500 MDH, 2027 ≥ 350, 2028 ≥ 200), tout prestataire personne morale d'une banque ou d'un grand compte perd 25 % de trésorerie sans attestation. Aucun outil ne le suit. | S | Dépend du moteur d'obligations. | now |

### 2.2 Ce qui rend le produit inévitable (next)

| Axe | Verdict | Problème → Fonctionnalité | Pourquoi Maroc | Effort | Dépendances / risque | Prio |
|---|---|---|---|---|---|---|
| **OCR de documents marocains hébergé au Maroc** | VALIDÉ, séquencé | Saisie manuelle des identifiants et typage manuel → extraction CIN, ICE, IF, RC, montants HT/TVA/TTC, recherche plein texte, classement automatique des photos WhatsApp. | Google Invoice Parser ne lit pas l'arabe, AWS Textract non plus ; envoyer une CIN à une API US/EU = transfert CNDP. Un OCR auto-hébergé (PaddleOCR/Tesseract avec correction RTL) ou OCI région Casablanca est un avantage structurel face à tout concurrent étranger. | L | Performance réelle sur CIN bilingues non testée → jeu d'échantillons dès le MVP. MVP = typage manuel + regex ICE/IF ; OCR complet en phase 2. | next |
| **Générateurs de fichiers officiels + import/export Sage/KHABIR** | VALIDÉ | Ressaisie entre outils → export CSV/Excel des balances, génération XML état 9421, relevé de déductions TVA (EDI), eBDS DAMANCOM ; import des écritures KHABIR/Sage. | SIMPL et DAMANCOM n'ont **pas d'API** : le seul levier est le fichier. GénéraFi a montré la voie avec « SIMPL Manager ». | M | Formats exacts 2026 non vérifiés ; RPA optionnelle seulement. Ne pas refaire la production comptable. | next |
| **Score de conformité client 0-100** | VALIDÉ | Portefeuille non trié → score = complétude des pièces + respect des échéances + paiement des honoraires ; envoyé au client chaque mois par WhatsApp (« votre score Direct Conseil : 82/100, il manque 3 factures »). | Répond au reproche des dirigeants (« aucune transparence, je pilote à l'aveugle ») et transforme le cabinet en conseiller. Base d'une surcharge « client difficile ». | M | Dépend de la collecte et du moteur. Pondération = hypothèse à calibrer. | next |
| **Time tracking léger + rentabilité réelle** | VALIDÉ | Dossiers non rentables invisibles → timer par dossier, comparaison aux fourchettes de marché (AE 300-1 000 DH, TPE 600-5 000, PME 5 000-15 000). | Pression sur les prix (bilans « à des prix très bas »), aucun barème depuis la sanction du Conseil de la concurrence (2022). | S/M | Adoption faible du timer en petite fiduciaire (hypothèse) → temps standard par défaut. | next |
| **E-signature de la lettre de mission et des PV** | VALIDÉ, en deux temps | Signature manuscrite scannée = **aucune valeur juridique** (FAQ DGSSI Q19) → signature simple/avancée avec hash SHA-256 + horodatage pour lettres de mission et PV internes ; signature qualifiée à distance via Barid eSign pour les actes à fort enjeu. | Loi 43-20 en vigueur, Barid eSign accrédité. Le dépôt des comptes (depotbilan) et les PV d'AG deviennent 100 % numériques. | M | Grille Barid eSign inconnue (≈ 1 200 DH/an cité, non vérifié) ; liste des PSCo agréés non publiée. | next |
| **Module contrôle fiscal** | VALIDÉ (recentré) | Panique à la réception d'un avis → compte à rebours (avis 15 j, réponse 30 j, 2e notification 60 j, recours 30 j), checklist des pièces, journal des échanges, **export complet du dossier en un clic** (art. 210 : FEC sous 30 jours), registre des pertes de documents (LRAR sous 15 jours). | 82 017 contrôles sur pièces en 2025 ; art. 213 : absence de pièces = rejet de comptabilité. | M | Délais 30/60 j confirmés seulement sur sources secondaires → à sécuriser sur art. 220-221. | next |
| **Portail / app client FR-AR-darija** | VALIDÉ, après le bot WhatsApp | Le client n'a aucune visibilité → statut des obligations, dépôt de pièces, téléchargement d'attestations, paiement des honoraires, en marque blanche pour le cabinet. | Seuls les « cabinets en ligne » l'offrent à leurs propres clients ; Hisab le vend en marque blanche aux comptables (832 MAD/mois). Le bilinguisme « dès le premier jour » est un standard local. | L | Commencer par un **bot WhatsApp** (statut, prochaine échéance, montant dû) : 80 % de la valeur pour 20 % de l'effort (hypothèse). | next (bot) / later (app) |

### 2.3 Plus tard, ou rejeté

| Axe | Verdict | Raison |
|---|---|---|
| **« Radar contrôle fiscal » prédictif (recoupements DGI)** | REJETÉ en tant que prédiction ; RETENU en « signaux faibles » | Personne ne connaît les algorithmes de la DGI ; vendre une prédiction serait trompeur. En revanche, des signaux **sourcés** sont faciles : espèces > 5 000 DH/jour ou 50 000 DH/mois par fournisseur (art. 11-II/106-II — corrigé, pas 20 000), résultat déficitaire sans état explicatif (art. 20-IV/82-IV, amende 2 000 DH), ICE manquant, factures AE > 80 000 DH chez un même client (RAS 30 %), seuils de bascule (CPU/RNS 2 M/500 k, AE 500 k/200 k, TVA 1 M, coopérative 10 M, syndic 200 k/500 k/1 M). Intégré au moteur (next). |
| **Assistant IA sur le CGI 2026 et les notes circulaires** | VALIDÉ mais later, usage interne uniquement | Corpus disponible (CGI 2026 de 765 pages, NC 737). Valeur réelle mais risque de conseil erroné et coût L ; à réserver au cabinet, jamais au client, avec citation d'article obligatoire. Avant cela, le **changelog réglementaire** (now, S) capte l'essentiel du bénéfice marketing. |
| **Parsing de relevés bancaires PDF + rapprochement** | later | Open banking non réglementé, aucune API bancaire ; l'OCR arabe/français doit d'abord être fiable. Effort L. |
| **Intégration OMPIC / depotbilan** | later (API) / now (checklist) | API Directinfo « base + options × 50 000 DH » invérifiable ; depotbilan sans API. Dans le MVP : checklist de formalités avec délais (RC dans le mois, bénéficiaires effectifs dans le mois, dépôt des comptes 30 j SARL / 2 mois SA). |
| **Marketplace cabinets ↔ clients** | REJETÉ pour 24 mois | Problème du démarrage à froid, sensibilité des Ordres (seuls EC et CA peuvent légalement tenir la comptabilité de tiers ; fiduciaires sans titre exclues par la loi 53-19 — risque de faire de Direct Conseil un complice d'exercice illégal), et cannibalisation de la confiance des cabinets. Remplacer par des **partenariats apporteurs de dossiers** (Charikaty, Dar Al Moukawil, Bank of Africa, Inyad) avec routage vers les cabinets Direct Conseil. |
| **Paie complète** | REJETÉ | Humantal, Mizan, OJRA, AJIEL existent ; « la paie reste le point faible d'Odoo ». Se connecter (import eBDS) plutôt que construire. |
| **Communauté de comptables** | VALIDÉ comme canal, pas comme produit | Ressources gratuites (calendrier fiscal 2027 versionné, simulateur de pénalités, changelog LF), groupe WhatsApp Direct Conseil, présence congrès OEC (novembre) et GITEX Africa (avril). Cible : les groupes Facebook existants (« Fiduciaire Maroc » ≈ 48 000 abonnés). |

---

## 3. Trois moments « wow » pour une démo de 10 minutes

**Wow n°1 (minute 0-3) — « Votre Excel devient un cabinet piloté ».** Le prospect apporte son fichier Excel de clients. Import CSV : 80 dossiers créés, typés, avec leurs identifiants validés (ICE en rouge quand la clé mod 97 est fausse). Trois secondes plus tard, le moteur a généré l'échéancier de chacun pour l'exercice et l'écran affiche : *« 11 clients en rouge aujourd'hui. Coût estimé des retards : 14 300 DH (art. 184/208 CGI + CNSS). »* La question qui vend : « Saviez-vous lesquels avant de venir ? »

**Wow n°2 (minute 3-6) — « La facture arrive par WhatsApp, elle se range toute seule ».** Le commercial sort son téléphone, envoie la photo d'une facture au numéro WhatsApp du cabinet de démo. Elle apparaît dans le dossier du client de démo, la case « factures d'achat — août » se coche, le compteur de pièces manquantes passe de 3 à 2. Puis on clique « relancer les 6 clients en retard » : le prospect voit partir un message en darija avec la liste exacte des pièces manquantes. Enfin, on saisit le montant en espèces d'une facture > 5 000 DH : alerte « TVA non déductible (art. 106-II) ».

**Wow n°3 (minute 6-10) — « Le jour où ça tourne mal ».** Scénario 1 : 30 avril, SIMPL est en panne. Clic sur « Mode panne » : chaque tentative est horodatée, la capture d'écran stockée, la réclamation de remise de majorations pré-rédigée. Scénario 2 : un contrôleur demande le dossier d'un client. On tape son nom, la fiche 360 apparaît (identifiants, 10 ans de pièces hashées et horodatées, preuves de dépôt, PV signés) → « Exporter le dossier complet » en un clic. Scénario 3 : un collaborateur démissionne. Clic « désactiver » → fiche de passation générée (dossiers, accès portails, particularités, échéances à 30 jours). Message : « Avec Direct Conseil, le cabinet ne dépend plus d'une personne ni d'un serveur étranger : hébergé au Maroc, déclaré CNDP. »

---

## 4. Stratégie de « moat » (défendabilité)

1. **Effet de réseau cabinet → client → cabinet.** Chaque client final reçoit ses relances, son score de conformité et ses attestations « via Direct Conseil » sur WhatsApp. Un dirigeant qui possède deux sociétés chez deux fiduciaires différentes demandera à la seconde pourquoi elle n'a pas Direct Conseil (hypothèse, mécanisme classique du portail en marque blanche). Objectif : que le nom devienne le standard de la relation cabinet-client, comme Damancom l'est pour la CNSS.
2. **Données réglementaires vivantes.** Le moteur de règles versionné (LF 2025/2026/2027, jours fériés, changelog) est un actif qui se renforce chaque année et que ni ExpertC ni Kabineo ne possèdent. Y ajouter des données que personne n'a : benchmarks anonymisés d'honoraires par type de dossier, statistiques de pannes SIMPL/DAMANCOM, taux de retard par obligation — vendus ensuite aux Ordres et à la presse comme « baromètre Direct Conseil » (hypothèse).
3. **Intégrations = fossé technique.** Sans API DGI/CNSS, la valeur est dans les fichiers (état 9421, EDI TVA, eBDS), les connecteurs Sage/KHABIR, les partenariats Hisab/Facturis (facturation client), Humantal/Mizan (paie), et le futur connecteur xHub dès publication de la spécification. Chaque format maîtrisé est un mois de retard pour un entrant.
4. **Coûts de sortie légitimes.** Dix ans d'archives probantes (hash, horodatage, journal d'audit), l'historique des preuves de dépôt et le coffre des accès sont **exportables en un clic** (exigence CNDP et contrôle fiscal) — mais l'export ne recrée pas les règles, les relances ni le score. La rétention vient de la confiance, pas du verrouillage.
5. **Marque et distribution.** Prix publics en MAD (199/449/899 DH HT/mois, seul ExpertC publie ses prix), hébergement au Maroc, kit CNDP, support WhatsApp en darija aux heures d'échéances, devis « éligible MOWAKABA/PACTE TPME » (éligibilité d'un abonnement SaaS à confirmer), références OEC/OPCA visibles, parrainage (1 mois offert).
6. **Communauté avant le produit.** Calendrier fiscal gratuit, simulateur de pénalités public, changelog LF diffusé dans les groupes Facebook et au congrès OEC : Direct Conseil devient la source de référence des comptables agréés de province avant même d'être leur logiciel.

---

## 5. Ce que « n°1 au Maroc » veut dire, mesurablement, à 24 mois

Base : TAM ≈ 6 000 structures × 5 400 DH ≈ 32 MDH/an ; plan média an 1 ≈ 226 000 DH → 170-190 cabinets et ≈ 80 000 DH de MRR (digest). Cibles à M+24 (hypothèses cohérentes avec ces bases) :

| Indicateur | Cible M+24 | Pourquoi c'est « n°1 » |
|---|---|---|
| Cabinets payants | **600-700** (≈ 10-12 % du marché adressable) | Aucun acteur local de gestion de cabinet ne revendique 100 clients ; Experio (production) en revendique 3 000 utilisateurs. |
| Dossiers actifs sous gestion | **≥ 50 000** (≈ 80 par cabinet) | ≈ 13 % des 380 230 entreprises personnes morales actives : masse critique pour le baromètre et les partenaires. |
| MRR | **≈ 280 000-320 000 DH HT** (ARPA 450 DH) | ≈ 3,5-3,8 MDH d'ARR, seuil de rentabilité d'une équipe de 8-10 personnes (hypothèse). |
| Churn mensuel | **≤ 2 %** (3 % toléré an 1) | LTV ≈ 18 000 DH, LTV/CAC ≥ 5 avec CAC ≤ 3 000 DH. |
| Preuve de valeur | **Taux d'obligations déposées à temps ≥ 95 %** chez les clients Direct Conseil (vs inconnu avant) ; 0 pénalité « oubliée » constatée | C'est la promesse marketing, il faut la mesurer. |
| Couverture | Casablanca-Settat + Rabat-Salé-Kénitra à M+12 ; Tanger, Marrakech, Agadir, Fès à M+24 | Suit la répartition des EC (88 % sur l'axe) puis des CA « de province ». |
| Notoriété | 1re position Google sur « logiciel fiduciaire Maroc », « suivi déclarations DGI », « gestion cabinet comptable » ; stand au congrès OEC ; convention ou tarif membre avec l'OPCA (conditions à négocier) | Personne n'occupe ces requêtes avec un produit dédié. |
| Écosystème | ≥ 3 connecteurs vivants (Sage/KHABIR import, Hisab ou Facturis, Humantal ou Mizan) ; connecteur e-facture prêt le jour de la publication du décret | Le fossé technique décrit en §4. |

Séquence : **0-6 mois** socle §2.1 + 30 cabinets pilotes à Casablanca (onboarding sur site, prix pilote) ; **6-12 mois** OCR, fichiers officiels, score, bot WhatsApp, lancement des campagnes (janvier-février avant la saison des bilans, septembre) ; **12-24 mois** portail client, e-signature qualifiée, module contrôle fiscal, expansion régionale, baromètre Direct Conseil et partenariats apporteurs de dossiers.

**Trois risques à lever avant d'écrire une ligne de code** : (1) 15-20 entretiens de fiduciaires sur l'acceptation du WhatsApp tiers, la grille 199/449/899 et le taux d'impayés réel ; (2) réponse écrite de la CNDP sur F112 vs dispense pour « tenue de comptabilité » et sur le statut de sous-traitant ; (3) test d'OCR sur 200 CIN/factures marocaines réelles pour décider entre auto-hébergé et OCI Casablanca.


---

# STRATÉGIE C-business-GTM

# Business plan — Direct Conseil, plateforme de gestion de cabinet pour fiduciaires, comptables agréés et experts-comptables au Maroc

*Version du 2 septembre 2026. Toutes les données chiffrées proviennent du digest de recherche et du fichier de vérification ; les corrections (CORRIGÉ) ont été appliquées, les points NON VÉRIFIÉS sont signalés « à confirmer », et les chiffres propres à ce plan sont étiquetés « hypothèse ».*

---

## 1. Taille du marché (TAM / SAM / SOM)

**Populations vérifiées côté cabinets (clients du SaaS)**

| Population | Effectif | Statut de la donnée |
|---|---|---|
| Experts-comptables OEC | 792 personnes physiques / 451 cabinets (nov. 2023) ; 867 en exercice (nov. 2025) ; 887 inscrits (avril 2026) | vérifié (OEC) |
| Comptables agréés OPCA | 3 934 inscrits sur les listes MEF (2024) ; ~3 900 projetés après clôture de la période transitoire (20/08/2025) | à confirmer (site opca.ma inaccessible) |
| Fiduciaires non ordinales | ~2 400 « sans statut » (2017), ~2 500 (2022), « plus de 800 » exclues par la loi 53-19 (2025) ; « > 4 000 » = chiffre vendeur non sourcé | à confirmer |
| Annuaire Telecontact « Fiduciaire » | Casablanca 241, Marrakech 76, Tanger 51, Agadir 49, Rabat 39, Fès 39 | vérifié (2026) |

**Populations côté dossiers (ce que gèrent les cabinets)** : 380 230 entreprises personnes morales actives (2024, 86,6 % micro) ; 109 656 créations en 2025 (78 622 PM + 31 034 PP) ; 144 942 nouvelles adhésions fiscales 2025 ; 463 383 auto-entrepreneurs (dont ~17 % déclarants par trimestre) ; 65 315 coopératives (fin 2025) ; ~236 000 associations déclarées (beaucoup inactives).

**Hypothèses de sizing**

- Nombre de structures = 451 cabinets EC + 3 900 comptables agréés + 2 000 fiduciaires non ordinales encore actives (hypothèse basse, entre les 800 exclues et les 2 500 de 2022) ≈ **6 350 structures**.
- ARPA cible = 450 DH HT/mois (5 400 DH/an), mix Solo/Cabinet/Pro (hypothèse, cf. grille §3).
- Un cabinet gère ~100 dossiers (ordre de grandeur vendeur, non mesuré) : 6 350 × 100 ≈ 635 000 dossiers, cohérent avec 380 000 EPMA + ~80 000 AE actifs + coopératives/associations actives.

| Niveau | Définition | Cabinets | MAD HT/an |
|---|---|---|---|
| **TAM** | Toutes les structures tenant la comptabilité de tiers au Maroc | ~6 350 | **~34 MDH** (× 5 400) |
| **SAM** | Structures de 1 à 20 personnes dans les 6 grandes agglomérations (Casablanca-Settat 37,8 % des EPMA et 68 % des EC ; Rabat-SK 14,1 % ; Tanger, Marrakech, Fès, Agadir), équipées d'un accès internet, hors Big Four et gros cabinets déjà sur Sage Expert : hypothèse 55 % du TAM | ~3 500 | **~19 MDH** |
| **SOM 12 mois** | Résultat du plan §5 | ~175 payants | ~0,95 MDH d'ARR (MRR ~79 kDH) |
| **SOM 36 mois** | Position n°1 = 15-20 % du TAM | 1 000-1 200 | **5,4-6,5 MDH** |

Le marché est petit en valeur mais quasi vide : aucun outil marocain ne combine fiche client structurée, GED rattachée et statut automatique des obligations (ExpertC n'a ni GED ni obligations, Experio ni fiche ni honoraires, Kabineo n'est pas localisé). Le relais de croissance au-delà de 6 MDH viendra des options (portail client, e-facturation, paie légère) et non du nombre de cabinets.

---

## 2. Positionnement et messages

**Promesse centrale (français)** : *« Direct Conseil : tapez le nom du client, tout le dossier apparaît — identifiants, documents scannés, et chaque obligation en vert ou en rouge avant que la DGI ne s'en aperçoive. »* Direct Conseil n'est pas un logiciel comptable : il se pose au-dessus de Sage, KHABIR, EBP ou Odoo (import Excel/CSV) comme couche de gestion de cabinet : CRM client, échéancier, GED, honoraires, statistiques.

| Segment | Douleur documentée | Message |
|---|---|---|
| **Fiduciaires 1-5 personnes** (cœur de cible) | « Un fichier Excel par client », pièces reçues par WhatsApp/clé USB, pénalités automatiques quand SIMPL tombe en panne, honoraires en notes HT informelles | « Plus rien ne se perd, plus rien n'est en retard. Vos 80 dossiers dans une seule fiche, vos échéances TVA/CNSS en rouge 7 jours avant, vos honoraires encaissés. » |
| **Cabinets d'expertise comptable (OEC)** | Équipés Sage Expert mais sans pilotage : marge par dossier, charge par collaborateur, lettres de mission, secret professionnel, turnover | « Le tableau de bord que Sage ne vous donne pas : rentabilité par dossier, charge par chef de mission, journal d'audit conforme loi 09-08, données hébergées au Maroc. » |
| **Comptables agréés récemment régularisés (~3 900)** | Nouveau cachet OPCA, pas de process, concurrence des « bilans à prix cassés », projet de code de déontologie imposant des honoraires écrits (décret 2.23.150, projet) | « Vous avez le cachet, ayez le cabinet : lettre de mission signée, facture avec TVA, dossier client irréprochable, en 10 minutes à partir de votre Excel. » |

**Trois taglines en darija** (à tester en pub Meta/YouTube) :
1. **« دفتر : كتب سمية الكليان، الملف كيبان »** — *Direct Conseil : kteb smiyat l-client, l-milaf kayban.* (Tape le nom du client, le dossier apparaît.)
2. **« الأحمر كيبان عندك قبل ما تجي الغرامة »** — *L7mar kayban 3endek qbel ma tji l-gharama.* (Le rouge s'affiche chez toi avant que la pénalité n'arrive.)
3. **« سالينا مع الكارطونات و الإكسيل : كلشي فدفتر »** — *Salina m3a l-kartonat w l-Excel : kolchi f Direct Conseil.* (Fini les cartons et l'Excel : tout est dans Direct Conseil.)

Règles de communication : jamais de mention « conseil fiscal » ou « certification » (monopole OEC, loi 15-89) ; ne pas prétendre à une « certification CNDP » ; ne pas promettre de dates pour la facturation électronique (décret non publié, calendriers des éditeurs non officiels — CORRIGÉ).

---

## 3. Grille tarifaire (MAD HT, TVA 20 % en sus)

| Plan | Mensuel | Annuel (2 mois offerts) | Inclus | Cible |
|---|---|---|---|---|
| **Solo** | 199 | 1 990 | 2 utilisateurs, 30 dossiers, 5 Go GED, moteur d'obligations, alertes | comptable agréé seul, fiduciaire individuelle |
| **Cabinet** | 449 | 4 490 | 5 utilisateurs, 150 dossiers, 50 Go, dashboard, rappels WhatsApp/SMS clients, honoraires et relances | fiduciaire 2-6 personnes |
| **Pro** | 899 | 8 990 | 15 utilisateurs, dossiers illimités, portail client (phase 2), multi-sites, API/export, onboarding sur site inclus | cabinets OEC, comptables agréés multi-bureaux |
| Options | +49 DH/utilisateur ; +150 DH/50 dossiers ; onboarding sur site 1 500-3 000 DH (Solo/Cabinet) | | | |

- **Essai gratuit** : 14 jours, sans carte, avec import Excel guidé dès le premier jour.
- **Freemium** : **non** en année 1. Le segment fiduciaire est sensible au prix et le support en darija coûte ; un plan gratuit attirerait les structures les moins solvables et diluerait le positionnement « professionnel ». À reconsidérer en année 2 pour les stagiaires/ENCG (plan étudiant 5 dossiers).
- **Frais d'onboarding** : 0 DH en ligne (import CSV + visio), payants sur site ; le devis annuel détaillé est généré automatiquement pour un dossier **Mowakaba** (TPE : 90 % subventionnés, plafond 40 000 DH) — éligibilité d'un abonnement SaaS OPEX **à confirmer** auprès de Maroc PME.
- **Prix publics affichés en MAD** : aucun concurrent ne le fait (Sage, Experio, Fiducio, GénéraFi sont « sur devis »).

**Justification face à ce que paient les cabinets aujourd'hui**

| Référence | Coût observé | Lecture |
|---|---|---|
| Sage Expert | 12 000-25 000 DH/an (+ maintenance ~20 %) | Direct Conseil Cabinet = 4 490 DH/an, complément, pas remplacement |
| KHABIR | 5 000-12 000 DH licence + 15-20 % | idem, production comptable |
| ExpertC | 60-80 DH/utilisateur/mois | 5 utilisateurs = 300-400 DH sans GED ni obligations ; Direct Conseil 449 avec les deux |
| Fiducio | 80-150 €/mois (≈ 880-1 650 DH) | à confirmer (site illisible) ; Direct Conseil en dessous |
| Finza (offre cabinets) | 3 800-22 000 DH/an | Direct Conseil dans la fourchette basse |
| Kabineo (France) | ≈ 11 DH/dossier/mois | 150 dossiers = 1 650 DH/mois ; Direct Conseil ≈ 3 DH/dossier |
| Honoraires du cabinet | TPE 500-1 500 DH/mois à Casablanca ; un cabinet de 50 dossiers à 1 000 DH encaisse ~50 000 DH/mois | Direct Conseil Cabinet = 0,9 % du CA ; une seule pénalité TVA évitée (5 % ≤ 30 j, 15 % au-delà, minimum 500 DH — art. 184 CGI) rembourse un mois |

Le seuil psychologique est le « < 1 000 DH/mois » que les fiduciaires pratiquent elles-mêmes : tous les plans mensuels restent sous ce seuil.

---

## 4. Plan de lancement

**Phase 0 — Préparation (sept.-oct. 2026)** : SARL, déclaration CNDP F211, hébergement au Maroc, MVP (fiche client, moteur d'obligations, GED, honoraires, dashboard), 15-20 entretiens de fiduciaires pour calibrer honoraires/impayés (donnée absente des sources).

**Phase 1 — Pilote gratuit (oct.-déc. 2026, M1-M3)** : 10 puis 20 cabinets à Casablanca (mix : 10 fiduciaires, 6 comptables agréés, 4 cabinets OEC), recrutés via groupes Facebook « Comptables Agréés au Maroc » / « Fiduciaire Comptable au Maroc », le congrès OEC de novembre et le terrain (241 fiduciaires listées à Casablanca). Contrepartie : un appel de feedback toutes les deux semaines, un témoignage vidéo en darija, autorisation d'afficher le logo. Objectif de sortie : 3 fonctionnalités « must-have » validées, 10 témoignages, taux d'import Excel réussi > 80 %, conversion payante ≥ 60 % en janvier.

**Phase 2 — Acquisition payante (janv. 2027, M4)** : lancement des campagnes en janvier-février, avant la saison des bilans (liasse au 31 mars, TP au 31 janvier, état des salaires avant le 1er mars), puis relance en septembre. Fin de la gratuité pilote avec tarif « fondateur » (-30 % à vie pour les 20 premiers, hypothèse).

**Séquencement géographique**

| Période | Villes | Justification | Moyen |
|---|---|---|---|
| M1-M6 | Casablanca-Settat | 37,8 % des EPMA, 68 % des EC, 33 959 créations 2025 | pilote + 1 commercial terrain + ads géociblées |
| M4-M9 | Rabat-Salé-Kénitra | 14,1 % des EPMA, 126 EC, Technopark/Startup VB | ads + déplacements hebdomadaires |
| M7-M12 | Tanger, Marrakech, Fès, Agadir | 12,7 % / 10,7 % / 7,7 % / 6 % des EPMA ; conseils régionaux OEC/OPCA ; GITEX Africa (Marrakech, avril) | ads + partenaires locaux (revendeurs Sage/Odoo, Omegasoft Agadir) + onboarding en visio |

---

## 5. Plan marketing 12 mois (M1 = octobre 2026 → M12 = septembre 2027)

**Benchmarks utilisés (digest)** : Meta B2B CPM 50-80 DH, CPC 4-8 DH, conversion landing 5-10 % → CPL 60-150 DH ; Google Search CPC « B2B/logiciel » 4-12 DH, finance 8-25 DH → CPL 80-240 DH ; LinkedIn 5-10 × Meta (benchmarks français, coût local à confirmer) ; lead → client 6-10 %.

**Hypothèses de funnel** : CPL mixte 120 DH ; lead → démo 40 % ; démo → payant 20 % (soit 8 % lead → client) ; **CAC média ≈ 1 500 DH** ; CAC total (avec commerciaux) ≈ 2 500-3 000 DH ; ARPA 450 DH ; marge brute 80 % ; churn 3 %/mois → LTV ≈ 12 000 DH, LTV/CAC ≈ 4, payback ~8 mois.

**Budget mensuel par canal (MAD)**

| Canal | M1-M3 | M4-M6 | M7-M9 | M10-M12 | Rôle |
|---|---|---|---|---|---|
| Meta (FB/IG, vidéo darija) | 2 000 | 8 000 | 10 000 | 12 000 | volume de leads fiduciaires |
| Google Search (« logiciel fiduciaire Maroc », « suivi déclarations DGI ») | 0 | 4 000 | 6 000 | 8 000 | intention forte |
| LinkedIn (retargeting cabinets OEC) | 0 | 0 | 2 000 | 3 000 | segment EC |
| YouTube darija (tutos, témoignages) | 500 | 1 000 | 2 000 | 2 000 | confiance |
| TikTok (jeunes comptables/stagiaires) | 0 | 0 | 1 000 | 1 000 | notoriété |
| Contenu darija/FR (montage, articles SEO, podcast) | 2 000 | 3 000 | 3 000 | 3 000 | SEO à la Oasis |
| Événements | Congrès OEC nov. 2026 : 15 000 (M2) | — | GITEX Africa avril 2027 : 20 000 (M7) | Entreprendre Expo / conseils régionaux : 10 000 | références, partenariats |
| Parrainage (1 mois offert par filleul) | 0 | ~1 000 | ~2 000 | ~3 000 | 25-30 % des nouveaux clients visés |
| Terrain (2 commerciaux, coût en §8) | — | Casablanca | + Rabat | + 4 villes | démo et onboarding sur site |

Total médias + contenu + événements sur 12 mois ≈ **265 000 DH** (hypothèse), dont ~185 000 DH d'achat média.

**Trajectoire clients et MRR (hypothèses)**

| Mois | Ads (DH) | Leads | Clients via ads (8 %) | Autres canaux* | Churn | Cabinets payants | MRR (DH HT) |
|---|---|---|---|---|---|---|---|
| M1 oct. 26 | 2 000 | — | 0 | pilote 10 (gratuit) | 0 | 0 | 0 |
| M2 nov. 26 | 2 000 + 15 000 évt | — | 0 | pilote 20 (gratuit) | 0 | 0 | 0 |
| M3 déc. 26 | 3 000 | 25 | 0 | 0 | 0 | 0 | 0 |
| M4 janv. 27 | 13 000 | 108 | 9 | 12 (pilote) + 2 | 0 | 23 | 10 350 |
| M5 fév. | 15 000 | 125 | 10 | 4 | 1 | 36 | 16 200 |
| M6 mars | 15 000 | 125 | 10 | 5 | 1 | 50 | 22 500 |
| M7 avr. | 21 000 + 20 000 GITEX | 175 | 14 | 8 | 2 | 70 | 31 500 |
| M8 mai | 21 000 | 175 | 14 | 8 | 2 | 90 | 40 500 |
| M9 juin | 21 000 | 175 | 14 | 9 | 3 | 110 | 49 500 |
| M10 juil. | 26 000 | 217 | 17 | 10 | 3 | 134 | 60 300 |
| M11 août | 20 000 | 167 | 13 | 8 | 4 | 151 | 67 950 |
| M12 sept. | 26 000 | 217 | 17 | 12 | 5 | **175** | **78 750** |

*Parrainage, partenaires, terrain, événements. Revenus cumulés année 1 ≈ 378 000 DH HT d'abonnements + ~30 000 DH d'onboarding sur site.

---

## 6. Partenariats et distribution

| Partenaire | Ce qu'on lui apporte | Ce qu'on en attend | Priorité |
|---|---|---|---|
| **Conseils régionaux OPCA** et **OEC** (6 conseils régionaux) | Tarif membre, webinaires « calendrier 2027 », kit CNDP pour les cabinets | Label/convention (conditions non publiées, à négocier), accès aux listes, stand au congrès | Haute |
| **Maroc PME — Mowakaba / PACTE TPME** (lancé 29/04/2026, 11 Mds DH, 50 000 entreprises) | Prestataire référencé, devis conformes | Financement 80-90 % de l'abonnement/onboarding ; éligibilité SaaS à confirmer | Haute |
| **Banques — Dar Al Moukawil (Attijariwafa, 25 centres), Bank of Africa (HSABATI PRO, délégation aux fiduciaires)** | Fiduciaires partenaires équipées pour leurs clients TPE | Apport de dossiers, co-marketing | Moyenne |
| **Technopark / Startup VB / CEED** | — | Locaux à 50 DH/m² HT (18 mois), bourse et prêt d'honneur, visibilité | Haute (dès M0) |
| **ENCG (12 écoles, 4 000-5 000 lauréats/an), ISCAE** | Licence gratuite pour les cours, cas pratiques | Futurs collaborateurs prescripteurs, stagiaires OPCA | Moyenne |
| **Revendeurs Sage/Odoo** (Forsoft, MS-MA, Omegasoft Agadir, Oasis, Karizma) | Commission 20 % première année (hypothèse), connecteur import/export | Distribution en régions, crédibilité auprès des cabinets équipés | Moyenne |
| **Experio, Hisab, Humantal, Facturis, Manageo** | Intégration (OCR/pré-compta, facturation clients, paie) au lieu de concurrence | Co-vente, connecteurs, préparation e-facturation 2027-2028 | Moyenne |
| **Charikaty, Inyad** | Routage des sociétés créées vers des fiduciaires Direct Conseil | Flux de nouveaux dossiers (109 656 créations/an) | Basse (année 2) |

---

## 7. Processus de vente, onboarding et confiance

**Cycle de vente (cible : 10 jours de la démo au paiement)**
1. Lead (pub, parrainage, terrain) → réponse WhatsApp Business en darija/français sous 1 h ouvrée.
2. Démo de 30 minutes en visio ou sur site (Casablanca/Rabat) sur les données du prospect : on importe son Excel de clients en direct, on montre ses obligations en rouge pour le mois.
3. Essai 14 jours avec checklist : import CSV (nom, forme, ICE, IF, RC, CNSS, régime TVA, honoraires), scan de 5 dossiers depuis le mobile, activation des rappels.
4. Formation d'1 h par rôle (gérant, chef de mission, aide-comptable, stagiaire) ; guide vidéo darija.
5. Paiement : virement pour l'annuel (habitude des fiduciaires), CMI carte récurrente pour le mensuel (1,8-2,5 % + 1,5 DH, affiliation 2-6 semaines — à confirmer), YouCan Pay (3,9 % + 2 MAD, cash via CashPlus) au démarrage.
6. Support WhatsApp 7j/7 aux heures de pointe (jusqu'au 10 pour la CNSS, fin de mois pour la TVA, mars-avril), onboarding sur site pour Pro.

**Construction de la confiance** (facteur n°1 dans un métier tenu au secret professionnel)

| Levier | Mise en œuvre |
|---|---|
| Hébergement au Maroc | inwi Business, N+ONE/Oracle Cloud Casablanca ou Atlas Cloud Services ; VPS local 539-879 DH/mois pour le MVP ; aucun transfert hors Maroc (art. 43-44 loi 09-08), OCR auto-hébergé |
| CNDP (loi 09-08) | Déclaration F211 de l'éditeur avant le lancement ; kit F112 pré-rempli pour chaque cabinet (les fiches contiennent des CIN → autorisation préalable) ; contrat de sous-traitance (DPA) dans les CGV ; journal d'audit ; MFA ; chiffrement |
| Références | Logos et témoignages vidéo des 20 pilotes (OEC/OPCA), page « références » par ville |
| Facture conforme | Facture avec ICE et TVA 20 %, devis annuel « éligible Mowakaba », préparation UBL 2.1 pour nos propres factures |
| Réversibilité | Export complet (CSV + PDF + ZIP des documents) en un clic, archivage 10 ans (art. 211 CGI) |
| Pas de fausse promesse | Pas de « certification CNDP/DGSSI » ; e-facturation affichée en « veille » tant que le décret n'est pas au BO |

---

## 8. Équipe, coûts année 1, structure et financement

**Structure juridique** : SARL (capital symbolique, coût total 7 600-16 430 DH, IS 20 %, exonération de taxe professionnelle 5 ans) ; le statut auto-entrepreneur est exclu (plafond 200 000 DH de services, retenue 30 % au-delà de 80 000 DH par client, impossibilité d'embaucher).

**Équipe (hypothèses de salaires bruts, hors fondateur)**

| Poste | Quand | Coût mensuel | Année 1 |
|---|---|---|---|
| Fondateur (produit, ventes, partenariats) | M0 | 5 000 | 60 000 |
| Développeur full-stack senior (freelance ou CDI) | M0 | 18 000 | 216 000 |
| Développeur junior | M7 | 9 000 | 54 000 |
| Customer success / onboarding (comptable confirmé, 5 ans en fiduciaire) | M0 | 8 000 | 96 000 |
| Commercial terrain n°1 (Casablanca) | M4 | 6 000 + commissions | 74 000 |
| Commercial terrain n°2 (Rabat/régions) | M7 | 6 000 | 36 000 |
| Charges patronales CNSS/AMO/TFP ≈ 21,09 % | | | ~113 000 |
| Expert-comptable conseil (advisor, equity + honoraires) | M0 | 2 000 | 24 000 |
| **Sous-total RH** | | | **~673 000** |

**Autres coûts année 1 (hypothèses)** : marketing 265 000 ; hébergement Maroc et sauvegardes 24 000 ; outils (WhatsApp BSP ≈ 540 DH/mois + messages utilitaires ≈ 0,045 MAD, SMS 0,30-0,49 DH, e-mail, e-signature) 30 000 ; création SARL, CNDP, CGV/DPA, avocat 40 000 ; comptable externe 18 000 ; Technopark 40 m² × 50 DH 24 000 ; déplacements/événements 25 000 ; divers 20 000. **Total charges année 1 ≈ 1,12 MDH ; revenus ≈ 0,41 MDH ; besoin de financement ≈ 0,7 MDH** (hypothèse, avant marge de sécurité de 20 %).

**Financement**

| Source | Montant | Conditions |
|---|---|---|
| Apport fondateur + love money | 150-200 kDH | equity |
| Innov Invest (Tamwilcom) Tech Start | ≤ 200 kDH à 0 % | via structure labellisée (Impact Lab, CEED, Bidaya, LaFactory) ; Tech Boost ≤ 500 kDH ensuite |
| Startup VB (Digital 2030) | bourse ≤ 200 kDH + prêt d'honneur ≤ 500 kDH | opérateurs Technopark, CEED, Flat6Labs |
| 212Founders / Maroc Numeric Fund | 100 k-1 M$ | late seed, après 300-500 cabinets (année 2) |

**Point mort (hypothèse)** : coûts fixes en régime de croisière ≈ 95 000 DH/mois ; à 80 % de marge brute il faut ≈ 120 000 DH de MRR, soit **~265 cabinets à 450 DH** ; au rythme de +18-20 cabinets nets/mois après M12, le point mort est atteint vers **M17-M19 (printemps 2028)**, ou M14-M15 si le churn descend à 2 % et le mix Pro dépasse 20 %.

---

## 9. KPIs et jalons vers la place de n°1

| KPI | M3 | M6 | M12 | M24 | M36 |
|---|---|---|---|---|---|
| Cabinets payants | 0 (20 pilotes) | 50 | 175 | 500 | 1 000-1 200 (n°1) |
| Dossiers gérés (≈ 70/cabinet, hypothèse) | 1 400 | 3 500 | 12 000 | 35 000 | 80 000+ |
| MRR (DH HT) | 0 | 22 500 | 79 000 | 240 000 | 500 000+ |
| Churn mensuel | — | ≤ 3 % | ≤ 3 % | ≤ 2 % | ≤ 1,5 % |
| NPS | ≥ 40 (pilotes) | ≥ 45 | ≥ 50 | ≥ 55 | ≥ 60 |
| Activation (import Excel terminé sous 7 jours) | 80 % | 80 % | 85 % | 90 % | 90 % |
| Essai → payant | — | 25 % | 30 % | 35 % | 35 % |
| CPL / CAC total | — | ≤ 150 / ≤ 3 000 | ≤ 120 / ≤ 2 500 | ≤ 100 / ≤ 2 000 | — |
| Part des clients par parrainage/partenaires | — | 20 % | 30 % | 40 % | 50 % |
| Obligations passées au vert avec preuve (usage) | — | 60 % | 75 % | 85 % | 90 % |

Jalons non chiffrés : convention avec un conseil régional OPCA (M6), référencement Maroc PME (M9), première ville hors axe Casa-Rabat à 20 cabinets (M12), connecteur e-facturation dès publication du décret, portail client mobile (M12-M18).

---

## 10. Risques et mitigations

| Risque | Probabilité / impact | Mitigation |
|---|---|---|
| **Confiance** : refus de confier CIN, identifiants SIMPL/Damancom et pièces à un tiers | Élevée / élevé | Hébergement au Maroc, F211 + kit F112, DPA, MFA, coffre chiffré sans stockage de mots de passe portails, export en un clic, références OEC/OPCA, pilote gratuit visible |
| **Churn** après la saison des bilans | Moyenne / élevé | Plans annuels (2 mois offerts), rappels WhatsApp qui créent l'habitude mensuelle (CNSS le 10, TVA fin de mois), CSM comptable de formation, score de conformité par client |
| **Réaction de Sage/Odoo/Experio** (module « gestion cabinet » ou baisse de prix) | Moyenne / moyen | Ne pas concurrencer la production comptable ; connecteurs import/export ; vitesse sur la localisation marocaine (obligations, pénalités, darija) ; partenariat plutôt qu'affrontement avec Experio (partenaire OEC) |
| **Réglementation** : réforme de la loi 09-08, décret e-facturation, question de l'exercice illégal par des fiduciaires sans titre | Moyenne / moyen | Veille juridique trimestrielle, règles versionnées (LF 2026/2027), CGU précisant que Direct Conseil est un outil et non un prestataire comptable ; obtenir un avis écrit sur la vente à des fiduciaires non ordinales |
| **Fatigue publicitaire** et hausse des CPL sur une audience de 6 000 structures | Élevée / moyen | Rotation créative en darija, contenu SEO et YouTube, parrainage (objectif 30-50 % des clients), événements et terrain ; plafond CPL 150 DH sinon pause |
| **Encaissement** : fiduciaires habituées aux espèces/chèques, impayés | Moyenne / moyen | Prépaiement annuel par virement, carte récurrente CMI, cash via CashPlus (YouCan Pay), suspension en lecture seule après 30 jours d'impayé, relance automatique |
| **Dépendance aux portails publics** (pannes SIMPL/Damancom, pas d'API) | Élevée / faible pour nous | « Mode panne » horodaté et réclamation type : la panne devient un argument de vente, pas un risque produit |
| **Sous-capitalisation** (besoin ~0,7 MDH) | Moyenne / élevé | Enchaîner Innov Invest + Startup VB dès M0, facturer l'annuel pour la trésorerie, embauches commerciales conditionnées au MRR |

**Prochaines actions (30 jours)** : constituer la SARL et déposer la F211 ; choisir l'hébergeur marocain ; recruter le CSM comptable ; lancer les 15-20 entretiens de fiduciaires (honoraires, impayés, nombre de dossiers par collaborateur) ; réserver la présence au congrès OEC de novembre ; confirmer auprès de Maroc PME l'éligibilité Mowakaba d'un abonnement SaaS ; récupérer le tableau OPCA du 19/09/2025 pour figer le TAM.
