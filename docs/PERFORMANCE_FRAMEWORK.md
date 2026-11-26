# Performance Framework (spécification — implémentation en Phase 3)

## Échelle comportementale

| Note | Indice | Niveau |
|---|---:|---|
| 1 | 20 | Insuffisant |
| 2 | 40 | En acquisition |
| 3 | 60 | Acquis |
| 4 | 80 | Maîtrisé |
| 5 | 100 | Maîtrise supérieure |
| N/E | non calculé | Non évalué |

**Formule** : `Indice = Σ(note_sur_100 × pondération) ÷ Σ(pondérations des critères effectivement évalués)`.
Un critère N/E est exclu du numérateur **et** du dénominateur : il ne pénalise jamais.
Publication d'un indice global seulement si le nombre d'observations atteint `application_settings.min_observations_for_index` (défaut 3) ; sinon « Données insuffisantes ».

## Sources de l'évaluation technique
Tests techniques 20 % · Entraînement 30 % · Compétition 50 %. Si une source est absente, les poids sont renormalisés sur les sources présentes et la fiabilité affichée est abaissée. La vidéo est une **preuve** rattachée à une note, jamais une source supplémentaire.

## Pondérations globales par poste (en %)

| Poste | Tech. | Tact. | Athl. | Cogn. | Ment. | Comp. |
|---|---:|---:|---:|---:|---:|---:|
| GB | 30 | 25 | 15 | 20 | 5 | 5 |
| DC | 20 | 35 | 20 | 15 | 5 | 5 |
| DD/DG | 25 | 25 | 25 | 15 | 5 | 5 |
| N°6 | 25 | 30 | 15 | 20 | 5 | 5 |
| N°8 | 25 | 25 | 20 | 20 | 5 | 5 |
| N°10 | 30 | 25 | 15 | 20 | 5 | 5 |
| Ailière | 30 | 20 | 25 | 15 | 5 | 5 |
| N°9 | 30 | 25 | 20 | 15 | 5 | 5 |
| Piston | 25 | 25 | 25 | 15 | 5 | 5 |

La colonne `positions.framework_key` (GB, DC, DD_DG, N6, N8, N10, AILIERE, N9, PISTON) relie déjà chaque poste à sa ligne.

## Référentiels techniques par poste
Repris intégralement du cahier des charges §20 (gardienne, défenseure centrale, latérale, N°6, N°8, N°10, ailière, N°9, piston) ; chaque geste évalué selon qualité d'exécution, efficacité, régularité, adaptabilité, pertinence.

## Versionnage
Tout référentiel et toute grille de pondération est figé dans une `framework_version`. Une évaluation référence la version utilisée ; modifier un référentiel crée une nouvelle version, sans réécrire l'historique. Les indices de développement (IDI, IDS, IDC) ne comparent que des évaluations sur critères et conditions comparables ; progression affichée en points absolus et en pourcentage relatif, séparément.

## Collectif
Cinq moments du jeu : organisation offensive 25 %, défensive 30 %, transition offensive 15 %, transition défensive 20 %, CPA 10 %. L'IPC est évalué directement sur la maîtrise du projet de jeu, jamais comme moyenne des notes individuelles.

## Indices
IPI, IPS, IPR (relationnel / intersectoriel), IPC, IDI, IDS, IDC, IMP. Chaque affichage montre : note, nombre d'observations, couverture des critères, période, contexte, évaluateur, version du référentiel, niveau de fiabilité.

## Garde-fous
Aspects mentaux et comportementaux : comportements observables uniquement, aucun diagnostic psychologique automatisé. Faits observables et interprétations de l'évaluateur saisis dans des champs distincts.
