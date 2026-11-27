import { describe, expect, it } from "vitest";
import { matchPlayer, type ImportPlayer } from "@/app/(app)/effectif/photos/match-photo";

const players: ImportPlayer[] = [
  { id: "a", name: "Aminata SANOGO", shirt: 16, hasPhoto: true },
  { id: "b", name: "Triphaine TANOH", shirt: 9, hasPhoto: false },
  { id: "c", name: "Grace Leslie TANOH", shirt: 11, hasPhoto: false },
  { id: "d", name: "Rolande Adjoua N'GUESSAN", shirt: null, hasPhoto: false },
  { id: "e", name: "Auremie N'GUESSAN", shirt: 1, hasPhoto: false },
];

describe("association photo → joueuse", () => {
  it("utilise le numéro de dossard", () => {
    expect(matchPlayer("16. AMINATA SANOGO -gardienne de But.jpg", players)).toBe("a");
    expect(matchPlayer("30.  DEBORA AZANIN - Gardienne de But.jpeg", players)).toBe("");
    expect(matchPlayer("9. TRIPHAINE TANOH - Attaquante.jpg", players)).toBe("b");
  });
  it("sinon le nom complet, sans confondre les homonymes", () => {
    expect(matchPlayer("ROLANDE ADJOUA N'GUESSAN - Milieu Offensive & Attaquante.jpeg", players)).toBe("d");
    expect(matchPlayer("TANOH.jpg", players)).toBe("");
  });
});
