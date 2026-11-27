import type { MatchSnapshotV1 } from "./contracts/match";

export type BoardSide = "south" | "north";

const standardMapIds = new Set([
  "1001",
  "1011",
  "1012",
  "1021",
  "1022",
  "1031",
  "1032",
]);

// Replay coordinates use metres with world y increasing toward the north.
// https://github.com/qbisi/mechcore/blob/master/docs/rules/map.md
export const standardBoard = {
  bounds: { x: -360, y: -310, width: 720, height: 620 },
  main: {
    south: { x: -300, y: -310, width: 600, height: 300 },
    north: { x: -300, y: 10, width: 600, height: 300 },
  },
  flank: {
    south: {
      left: { x: -360, y: 10, width: 60, height: 300 },
      right: { x: 300, y: 10, width: 60, height: 300 },
    },
    north: {
      left: { x: -360, y: -310, width: 60, height: 300 },
      right: { x: 300, y: -310, width: 60, height: 300 },
    },
  },
  flankOpensInRound: 2,
  towerFootprint: 20,
  towerDefenseRadius: 100,
  towers: [
    {
      id: "south-energy",
      side: "south",
      kind: "Energy Tower",
      x: -140,
      y: -170,
    },
    {
      id: "south-research",
      side: "south",
      kind: "Research Center",
      x: 140,
      y: -170,
    },
    {
      id: "north-research",
      side: "north",
      kind: "Research Center",
      x: -140,
      y: 170,
    },
    { id: "north-energy", side: "north", kind: "Energy Tower", x: 140, y: 170 },
  ],
} as const;

export function hasStandardBoard(match: MatchSnapshotV1) {
  return (
    match.meta.mode === "1v1" &&
    match.meta.players.length === 2 &&
    (!match.meta.mapId || standardMapIds.has(match.meta.mapId))
  );
}

export function boardSide(match: MatchSnapshotV1, playerId: string): BoardSide {
  const firstPlayer = match.meta.players[0]?.id;
  let firstSide: BoardSide = "south";
  for (const round of match.rounds) {
    const votes = (round.players[firstPlayer]?.units ?? []).reduce(
      (sum, unit) => {
        if (
          unit.positionKnown === false ||
          Math.abs(unit.x) > 300 ||
          Math.abs(unit.y) < 10
        )
          return sum;
        return sum + Math.sign(unit.y);
      },
      0,
    );
    if (votes !== 0) {
      firstSide = votes > 0 ? "north" : "south";
      break;
    }
  }
  return playerId === firstPlayer
    ? firstSide
    : firstSide === "south"
      ? "north"
      : "south";
}
