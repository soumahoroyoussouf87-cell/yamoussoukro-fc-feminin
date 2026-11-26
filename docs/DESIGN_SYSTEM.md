# Design system

## Palette officielle (immuable)

| Token | Valeur | Usage |
|---|---|---|
| `--yfc-royal` | #063580 | Identité, boutons secondaires, barres |
| `--yfc-night` | #07162E | Navigation, arrière-plans |
| `--yfc-fuchsia` | #FF0068 | Actions principales, accents, élément actif |
| `--yfc-white` | #FFFFFF | Textes sur fond sombre, surfaces claires |
| `--yfc-grey-light` | #F4F6FA | Fond du mode clair |
| `--yfc-slate` | #64748B | Texte secondaire (mode clair) |
| `--yfc-green` | #22C55E | Progression, disponible |
| `--yfc-orange` | #F59E0B | Vigilance |
| `--yfc-red` | #EF4444 | Alertes |

## Déclinaisons d'accessibilité (texte uniquement)

Ratios WCAG mesurés. Les couleurs officielles restent utilisées pour les aplats ; seules les couleurs de **texte** sont ajustées lorsque le contraste serait insuffisant.

| Cas | Ratio | Décision |
|---|---|---|
| Blanc / bleu nuit | 18,1:1 | OK |
| Blanc / bleu royal | 11,5:1 | OK |
| Ardoise #64748B / carte sombre | 3,5:1 | remplacé par #94A3B8 (6,6:1) en mode sombre |
| Fuchsia texte / blanc | 3,85:1 | texte en #D1005A (5,4:1) en mode clair |
| Fuchsia texte / carte sombre | 4,4:1 | texte en #FF5C9D (5,8:1) en mode sombre |
| Vert / orange texte en mode clair | — | #15803D et #B45309 (5,0:1) |
| **Blanc sur bouton fuchsia** | **3,85:1** | **À arbitrer** : conforme pour le texte large uniquement. Option : libellé bleu nuit (4,7:1). |

## Typographie
- Titres, chiffres, intitulés de cartes : **Barlow Condensed** 600-800, majuscules, interlettrage léger.
- Contenus : **Inter** 400-600.

## Composants
`Button` (default fuchsia, secondary royal, outline, ghost, destructive, link), `Card`, `Badge` (success/warning/danger/outline), `Field` + `Input`/`Select`/`Textarea`, `Table`, `EmptyState`, `PageHeader`, `ConfirmButton`, `ClubLogo`, `PlayerAvatar`.

## Règles
- Mode sombre par défaut, mode clair disponible (préférence mémorisée).
- Un statut = icône + libellé + couleur, jamais la couleur seule.
- Toute fonctionnalité non livrée est grisée, non cliquable, avec son numéro de phase.
- États vides explicites ; messages d'erreur en français, sans détail technique.
- Animations courtes, désactivées si `prefers-reduced-motion`.
- Logo : jamais recadré, déformé, recoloré ni filtré.
