# Architecture

Voir aussi `DOSSIER_CONCEPTION.md` §1.

## Arborescence du code

```
src/
  proxy.ts                    rafraîchit la session Supabase, redirige les non-connectés
  app/
    layout.tsx                polices, thème (cookie), service worker
    connexion/, mot-de-passe-oublie/, definir-mot-de-passe/, auth/confirm/   authentification
    acces-en-attente/, acces-refuse/, espace-joueuse/                          pages d'état
    (app)/                    espace staff (layout = barre latérale + barre supérieure)
      tableau-de-bord/  effectif/  disponibilites/  documents/  staff/
      administration/{utilisateurs,roles,parametres,journal,sauvegardes}/
      notifications/  recherche/  mon-compte/
      */actions.ts            Server Actions (validation Zod + requirePermission + RLS)
  components/ui               primitives (format shadcn/ui)
  components/{shell,players,staff,admin,auth}
  lib/
    auth.ts                   couche d'accès : session, club, rôles, permissions (React cache)
    club.ts                   en-tête institutionnel (saison / compétition actives)
    navigation.ts             menu complet, phase de chaque module
    data/                     requêtes de lecture
    domain/                   logique métier pure et testée (ex. bilan des matchs)
    supabase/{server,admin,database.types}.ts
supabase/
  migrations/                 schéma versionné (SQL)
  seed.sql                    identité du club pour le développement local
  templates/                  e-mails d'invitation et de réinitialisation
tests/unit, tests/security
scripts/                      amorçage du premier admin, tests de sécurité, sauvegarde
```

## Flux d'une écriture

1. Formulaire client → Server Action.
2. `requirePermission("players.write")` : refus immédiat si le rôle ne le permet pas.
3. Validation Zod (types, bornes, formats).
4. Requête Supabase **avec la session de l'utilisateur** → la RLS revérifie la permission.
5. Trigger d'audit → `audit_logs`.
6. `revalidatePath` puis redirection.

## Choix notables

- `cacheComponents` désactivé : chaque page est calculée pour l'utilisateur courant ; aucune donnée confidentielle dans un cache partagé.
- Composants au format shadcn/ui écrits dans le dépôt (le registre en ligne n'était pas joignable depuis l'environnement de build) : même API, mêmes dépendances (Radix, cva).
- Types de la base générés : `npx supabase gen types --local --lang typescript > src/lib/supabase/database.types.ts`.
