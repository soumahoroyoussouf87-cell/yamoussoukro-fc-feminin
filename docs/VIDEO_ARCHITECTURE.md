# Architecture vidéo (spécification — Phase 4)

1. **Import** : upload reprenable (protocole tus) directement vers le fournisseur (Mux ou Cloudflare Stream) via une URL d'upload signée émise par le serveur — le fichier ne transite pas par l'application. MP4 (H.264/H.265) prioritaire ; sources : VEO, Once Sport, Eyeball, XbotGo, Sony, TacticalPad, DaVinci, ordinateur, smartphone (import manuel tant que les API ne sont pas confirmées).
2. **Traitement** : transcodage adaptatif 480p/720p/1080p, miniatures automatiques ; originaux 4K conservés seulement sur option.
3. **Séquences** : un `video_clip` = repères début/fin sur une vidéo source (aucune copie de fichier) ; une séquence liée à plusieurs joueuses via `clip_players`. Chronomètre du match distinct du temps du fichier, avec table de synchronisation (décalages, interruptions).
4. **Accès** : lecture par jetons signés de courte durée. Une joueuse reçoit un jeton limité **à l'intervalle du clip autorisé** (`video_access_grants`), jamais la vidéo source complète.
5. **Coûts** : quotas par saison, suivi du stockage, archivage froid des anciennes saisons.
6. **Hors connexion** : aucune vidéo confidentielle en cache par défaut.

Codification : panneau personnalisable avec raccourcis clavier ; qualification couleur (vert positive, rouge à corriger, orange à améliorer, bleu référence, violet objectif, gris neutre). Vision par ordinateur (Phase 7) jamais présentée comme opérationnelle avant validation de modèles.
