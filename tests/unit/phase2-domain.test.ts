import { describe, expect, it } from "vitest";
import { matchDayLabel, mondayOf, weekDays } from "@/lib/domain/match-day";
import { computePlayerStats, scoreFromEvents } from "@/lib/domain/player-stats";
import { FORMATIONS } from "@/lib/domain/formations";

describe("Références J-x", () => {
  const week = weekDays("2026-11-30"); // lundi 30/11 → dimanche 06/12
  it("calcule J-6 … J et J+1 autour d'un match unique", () => {
    const labels = week.map((d) => matchDayLabel(d, ["2026-12-06"]));
    expect(labels).toEqual(["J-6", "J-5", "J-4", "J-3", "J-2", "J-1", "J"]);
    expect(matchDayLabel("2026-12-07", ["2026-12-06"])).toBe("J+1");
  });
  it("gère une semaine à deux rencontres", () => {
    const labels = week.map((d) => matchDayLabel(d, ["2026-12-02", "2026-12-06"]));
    expect(labels).toEqual(["J-2", "J-1", "J", "J+1 / J-3", "J-2", "J-1", "J"]);
  });
  it("n'invente aucune référence sans match", () => {
    expect(week.map((d) => matchDayLabel(d, []))).toEqual(Array(7).fill(null));
  });
  it("trouve le lundi de la semaine", () => {
    expect(mondayOf("2026-12-06")).toBe("2026-11-30");
    expect(mondayOf("2026-11-30")).toBe("2026-11-30");
  });
});

describe("Statistiques individuelles", () => {
  const lineups = [{ match_id: "m1", duration: 90, starters: ["a", "b"], substitutes: ["c", "d"] }];
  const events = [
    { match_id: "m1", type: "but", minute: 10, player_id: "a", related_player_id: "b" },
    { match_id: "m1", type: "remplacement", minute: 60, player_id: "a", related_player_id: "c" },
    { match_id: "m1", type: "carton_rouge", minute: 80, player_id: "b", related_player_id: null },
    { match_id: "m1", type: "but_adverse", minute: 85, player_id: null, related_player_id: null },
  ];
  const s = computePlayerStats(lineups, events);
  it("calcule minutes, titularisations et entrées en jeu", () => {
    expect(s.get("a")).toMatchObject({ played: 1, starts: 1, minutes: 60, goals: 1 });
    expect(s.get("b")).toMatchObject({ starts: 1, minutes: 80, assists: 1, red: 1 });
    expect(s.get("c")).toMatchObject({ played: 1, starts: 0, subAppearances: 1, minutes: 30 });
    expect(s.get("d")).toBeUndefined(); // remplaçante non entrée : aucun match joué
  });
  it("reconstitue le score depuis les événements", () => {
    expect(scoreFromEvents(events)).toEqual({ us: 1, them: 1 });
  });
});

describe("Systèmes de jeu", () => {
  it("chaque système place exactement 11 joueuses sur le terrain", () => {
    for (const [name, slots] of Object.entries(FORMATIONS)) {
      expect(slots, name).toHaveLength(11);
      for (const s of slots) expect(s.x >= 0 && s.x <= 100 && s.y >= 0 && s.y <= 100).toBe(true);
    }
  });
});
