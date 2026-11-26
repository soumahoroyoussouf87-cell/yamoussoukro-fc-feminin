/**
 * Systèmes de jeu proposés pour le onze de départ (cahier des charges §10).
 * Coordonnées en % du terrain : x de gauche à droite, y de l'attaque (0) vers le but (100).
 * Le placement reste libre ensuite (glisser-déposer).
 */
export type Slot = { label: string; x: number; y: number };

const GK: Slot = { label: "GB", x: 50, y: 92 };

export const FORMATIONS: Record<string, Slot[]> = {
  "4-4-2": [GK, { label: "DD", x: 85, y: 72 }, { label: "DC", x: 62, y: 76 }, { label: "DC", x: 38, y: 76 }, { label: "DG", x: 15, y: 72 },
    { label: "MD", x: 85, y: 48 }, { label: "MC", x: 60, y: 52 }, { label: "MC", x: 40, y: 52 }, { label: "MG", x: 15, y: 48 },
    { label: "BU", x: 60, y: 22 }, { label: "BU", x: 40, y: 22 }],
  "4-4-2 (2 sentinelles)": [GK, { label: "DD", x: 85, y: 72 }, { label: "DC", x: 62, y: 76 }, { label: "DC", x: 38, y: 76 }, { label: "DG", x: 15, y: 72 },
    { label: "N6", x: 60, y: 58 }, { label: "N6", x: 40, y: 58 }, { label: "MD", x: 85, y: 42 }, { label: "MG", x: 15, y: 42 },
    { label: "BU", x: 60, y: 20 }, { label: "BU", x: 40, y: 20 }],
  "4-4-2 losange": [GK, { label: "DD", x: 85, y: 72 }, { label: "DC", x: 62, y: 76 }, { label: "DC", x: 38, y: 76 }, { label: "DG", x: 15, y: 72 },
    { label: "N6", x: 50, y: 60 }, { label: "N8", x: 72, y: 48 }, { label: "N8", x: 28, y: 48 }, { label: "N10", x: 50, y: 36 },
    { label: "BU", x: 62, y: 18 }, { label: "BU", x: 38, y: 18 }],
  "4-3-3": [GK, { label: "DD", x: 85, y: 72 }, { label: "DC", x: 62, y: 76 }, { label: "DC", x: 38, y: 76 }, { label: "DG", x: 15, y: 72 },
    { label: "N6", x: 50, y: 58 }, { label: "N8", x: 70, y: 46 }, { label: "N8", x: 30, y: 46 },
    { label: "AD", x: 84, y: 22 }, { label: "N9", x: 50, y: 16 }, { label: "AG", x: 16, y: 22 }],
  "4-2-3-1": [GK, { label: "DD", x: 85, y: 72 }, { label: "DC", x: 62, y: 76 }, { label: "DC", x: 38, y: 76 }, { label: "DG", x: 15, y: 72 },
    { label: "N6", x: 62, y: 58 }, { label: "N6", x: 38, y: 58 }, { label: "AD", x: 82, y: 36 }, { label: "N10", x: 50, y: 36 }, { label: "AG", x: 18, y: 36 },
    { label: "N9", x: 50, y: 16 }],
  "3-5-2": [GK, { label: "DC", x: 72, y: 76 }, { label: "DC", x: 50, y: 78 }, { label: "DC", x: 28, y: 76 },
    { label: "PD", x: 90, y: 50 }, { label: "N8", x: 68, y: 48 }, { label: "N6", x: 50, y: 56 }, { label: "N8", x: 32, y: 48 }, { label: "PG", x: 10, y: 50 },
    { label: "BU", x: 60, y: 20 }, { label: "BU", x: 40, y: 20 }],
  "3-4-3": [GK, { label: "DC", x: 72, y: 76 }, { label: "DC", x: 50, y: 78 }, { label: "DC", x: 28, y: 76 },
    { label: "PD", x: 88, y: 50 }, { label: "N8", x: 60, y: 54 }, { label: "N8", x: 40, y: 54 }, { label: "PG", x: 12, y: 50 },
    { label: "AD", x: 80, y: 22 }, { label: "N9", x: 50, y: 16 }, { label: "AG", x: 20, y: 22 }],
  "5-3-2": [GK, { label: "PD", x: 90, y: 66 }, { label: "DC", x: 70, y: 76 }, { label: "DC", x: 50, y: 78 }, { label: "DC", x: 30, y: 76 }, { label: "PG", x: 10, y: 66 },
    { label: "N8", x: 70, y: 48 }, { label: "N6", x: 50, y: 54 }, { label: "N8", x: 30, y: 48 },
    { label: "BU", x: 60, y: 20 }, { label: "BU", x: 40, y: 20 }],
  "4-5-1": [GK, { label: "DD", x: 85, y: 72 }, { label: "DC", x: 62, y: 76 }, { label: "DC", x: 38, y: 76 }, { label: "DG", x: 15, y: 72 },
    { label: "MD", x: 86, y: 44 }, { label: "N8", x: 66, y: 50 }, { label: "N6", x: 50, y: 56 }, { label: "N8", x: 34, y: 50 }, { label: "MG", x: 14, y: 44 },
    { label: "N9", x: 50, y: 18 }],
};

export const SYSTEMS = [...Object.keys(FORMATIONS), "Personnalisé"];

export function slotsFor(system: string): Slot[] {
  return FORMATIONS[system] ?? FORMATIONS["4-3-3"];
}
