# Roadmap

| Phase | Statut | Contenu |
|---|---|---|
| 1 — Foundation | **Livrée le 26/11/2026** (en attente de validation du club) | Architecture, design system, auth, BDD, RLS, tableau de bord, effectif, staff, administration |
| 2 — Sport management | **Livrée le 26/11/2026** (en attente de validation du club) | Calendrier, macro/méso/microcycles, programme hebdomadaire J-6…J+1, fiches de séance, bibliothèque d'exercices, présences, Match Center, convocations, délégations, onze de départ, résultats, classement, statistiques |
| 3 — Performance framework | **En cours** : livraison 1 (référentiels, évaluation individuelle, IPI) prête le 27/11/2026 | Projet de jeu versionné, systèmes, référentiels, tests techniques, évaluations (individuelle, sectorielle, intersectorielle, collective), indices |
| 4 — Video & development | — | Vidéothèque, import, lecteur pro, codification, playlists, annotations, comparaison, PDI |
| 5 — Sport science | — | Tests physiques, GPS (CSV), charges, médical, portail joueuse |
| 6 — Intelligence | — | YFC PERFORMANCE AI, rapports intelligents, recommandations |
| 7 — Advanced football data | — | Vision par ordinateur, tracking, analyse spatiale |

Règle : une phase ne démarre qu'après vérification des critères d'acceptation de la précédente (`TEST_PLAN.md`).

## Notes Phase 2
- « Tâches du staff » est reporté en Phase 3 (hors périmètre Sport management).
- Le portail joueuse (consultation de ses convocations et du programme publié) arrivera avec la Phase 5.
- Les notifications sont internes à la plateforme ; l'envoi par e-mail nécessite un SMTP de production.

## Restant à faire avant mise en production de la Phase 1
- Création du projet Supabase de production et de l'hébergement (sur accord du club).
- SMTP de production pour les invitations.
- Arbitrage du contraste du bouton fuchsia (`DESIGN_SYSTEM.md`).
- Validation visuelle des polices Barlow Condensed / Inter.
