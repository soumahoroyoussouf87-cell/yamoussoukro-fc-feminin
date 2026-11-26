# YAMOUSSOUKRO FC FÉMININ — HIGH PERFORMANCE CENTER

**OBSERVER • ÉVALUER • PLANIFIER • DÉVELOPPER • PERFORMER**

Plateforme interne, confidentielle et sécurisée de management et de développement de la performance du Yamoussoukro FC Féminin. Ce n'est pas un site public.

- État : **Phase 1 — Foundation** livrée (voir `CHANGELOG.md` et `docs/ROADMAP.md`).
- Dossier de conception : `docs/DOSSIER_CONCEPTION.md`.

## Démarrage local

Prérequis : Node.js 22+, Docker.

```bash
npm install
npx supabase start            # Postgres, Auth, Storage, Mailpit en local
npx supabase db reset         # applique supabase/migrations + supabase/seed.sql
cp .env.example .env.local    # puis renseigner les clés affichées par `npx supabase status`
node --env-file=.env.local scripts/bootstrap-admin.mjs vous@club.ci "Nom Prénom"
npm run dev                   # http://localhost:3000
```

Le lien d'activation du premier administrateur arrive dans Mailpit (http://127.0.0.1:54324) en local.

> Si `ghcr.io` est inaccessible depuis votre réseau : `SUPABASE_INTERNAL_IMAGE_REGISTRY=docker.io npx supabase start`.

## Scripts

| Commande | Rôle |
|---|---|
| `npm run dev` / `npm run build` / `npm start` | Développement, compilation, production |
| `npm run typecheck` | Vérification TypeScript |
| `npm run lint` | ESLint |
| `npm test` | Tests unitaires |
| `npm run test:security` | Tests RLS / stockage multi-rôles (pile Supabase locale requise) |

## Documentation

`docs/` : ARCHITECTURE, ROADMAP, DATABASE_SCHEMA, DESIGN_SYSTEM, PERFORMANCE_FRAMEWORK, GAME_MODEL, VIDEO_ARCHITECTURE, SECURITY, PRIVACY, TEST_PLAN, DEPLOYMENT, USER_GUIDE ; `CHANGELOG.md` à la racine.

## Identité visuelle

Le logo officiel (`public/brand/logo-officiel-yfc.png`) est utilisé sans aucune modification. La maquette de référence est conservée dans `docs/reference/` à titre esthétique uniquement : aucune de ses données n'est utilisée.
