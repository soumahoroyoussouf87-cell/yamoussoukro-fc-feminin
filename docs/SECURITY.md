# Sécurité

## Mesures en place (Phase 1)
- **Authentification** : Supabase Auth, inscriptions publiques désactivées, comptes créés sur invitation, mots de passe ≥ 10 caractères avec majuscule, minuscule et chiffre, message d'échec générique.
- **Session** : cookies gérés par `@supabase/ssr`, rafraîchis par `proxy.ts` ; identité vérifiée côté serveur (`getUser` / `getClaims`), jamais déduite du navigateur.
- **Autorisation** : permissions calculées en base à partir de `user_roles` ; contrôle dans chaque page et action (`requirePermission`) **et** RLS sur toutes les tables et tous les buckets.
- **Anti-escalade** : impossible de s'attribuer un rôle, attribution réservée à `users.manage`, attributions non modifiables (révocation + nouvelle attribution), dernier administrateur protégé.
- **Séparation des rôles** : l'administrateur technique n'a accès ni au médical ni aux compositions ; la disponibilité sportive ne contient aucune donnée médicale.
- **Secrets** : `SUPABASE_SERVICE_ROLE_KEY` côté serveur uniquement (module `server-only`), jamais préfixée `NEXT_PUBLIC_`, `.env*` exclus de Git.
- **Stockage** : buckets privés, types MIME et tailles limités, URL signées (photos 1 h, documents 5 min).
- **Audit** : triggers sur 15 tables, journal en lecture seule.
- **En-têtes HTTP** : `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy`, `Permissions-Policy` ; `robots: noindex`.
- **Validation** : Zod sur toutes les entrées ; échappement des filtres de recherche.

## Mesures ajoutées (Phase 2)
- **Workflow contrôlé en base** : le trigger `app.guard_workflow` refuse toute transition non autorisée (un adjoint ne peut ni valider ni modifier un élément publié) ; chaque changement de statut est historisé dans `approval_history`.
- **Confidentialité des compositions** : convocations et onze provisoires visibles uniquement avec `lineups.read_draft` ; le rôle communication ne voit que les versions communiquées ; le commentaire confidentiel n'est pas lisible via l'API sans cette permission (privilège de colonne) et n'apparaît sur aucun document imprimé.
- **Délégations** verrouillées après validation.
- **Stockage** : bucket privé `exercise-diagrams` (images uniquement).

## Tests
`npm run test:security` : 14 scénarios multi-rôles (anonyme, sans rôle avec métadonnées piégées, admin, entraîneur, team manager, communication, intendant, deux joueuses).

## À faire avant production
- Activer la MFA pour les rôles administrateur et direction (Supabase Auth TOTP).
- Activer la protection contre les mots de passe compromis (offre Pro).
- Restreindre les URL de redirection Auth au domaine de production.
- Ajouter une Content-Security-Policy stricte après inventaire des domaines (Supabase, vidéo).
- Exécuter les tests de sécurité contre l'environnement de préproduction.

## Signaler une faille
Contacter l'administrateur de la plateforme ; ne pas divulguer publiquement.
