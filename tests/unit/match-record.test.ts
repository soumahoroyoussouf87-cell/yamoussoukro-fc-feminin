import { describe, expect, it } from "vitest";
import { computeMatchRecord } from "@/lib/domain/match-record";

describe("computeMatchRecord", () => {
  it("retourne un bilan vide sans match", () => {
    expect(computeMatchRecord([])).toEqual({ played: 0, wins: 0, draws: 0, losses: 0, goalsFor: 0, goalsAgainst: 0, cleanSheets: 0 });
  });

  it("compte victoires, nuls, défaites, buts et clean sheets", () => {
    const r = computeMatchRecord([
      { status: "joue", goals_for: 2, goals_against: 0 },
      { status: "joue", goals_for: 1, goals_against: 1 },
      { status: "joue", goals_for: 0, goals_against: 3 },
      { status: "joue", goals_for: 0, goals_against: 0 },
    ]);
    expect(r).toEqual({ played: 4, wins: 1, draws: 2, losses: 1, goalsFor: 3, goalsAgainst: 4, cleanSheets: 2 });
  });

  it("ignore les matchs non joués ou sans score", () => {
    const r = computeMatchRecord([
      { status: "programme", goals_for: null, goals_against: null },
      { status: "reporte", goals_for: null, goals_against: null },
      { status: "joue", goals_for: null, goals_against: 1 },
    ]);
    expect(r.played).toBe(0);
  });
});
