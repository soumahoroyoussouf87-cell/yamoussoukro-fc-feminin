# Déploiement

> Aucune mise en production sans validation explicite du club.

## 1. Supabase (production)
1. Créer le projet (région la plus proche de l'Afrique de l'Ouest disponible, ex. Europe de l'Ouest).
2. `npx supabase link --project-ref <ref>` puis `npx supabase db push` (applique `supabase/migrations`).
3. Créer le club : exécuter le contenu de `supabase/seed.sql` dans l'éditeur SQL (identité du club et équipe seniors uniquement).
4. Auth : désactiver les inscriptions, configurer le SMTP, `Site URL` = domaine de production, URL de redirection = `https://<domaine>/**`, importer les modèles `supabase/templates/*.html`.
5. Vérifier que les 4 buckets sont **privés**.

## 2. Application
Variables : `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (secret serveur), `NEXT_PUBLIC_SITE_URL`.
Hébergement Vercel (recommandé) ou `npm run build && npm start` derrière un proxy HTTPS.

## 3. Premier administrateur
`node --env-file=.env.production scripts/bootstrap-admin.mjs <email> "<nom>"` : envoie l'invitation et attribue le rôle admin (refusé si un admin existe déjà).

## 4. Sauvegardes et restauration
- Sauvegardes quotidiennes Supabase (offre Pro) ; restauration depuis le tableau de bord Supabase.
- Sauvegarde indépendante : `DATABASE_URL=... scripts/backup.sh` (pg_dump compressé et chiffré avec `BACKUP_PASSPHRASE`).
- Restauration : `gpg -d fichier.sql.gz.gpg | gunzip | psql "$DATABASE_URL"` sur une base vide, puis vérification par `npm run test:security` sur l'environnement restauré.
- Export fonctionnel JSON : Administration › Sauvegardes.
