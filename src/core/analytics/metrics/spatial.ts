import type { BoardRectangle } from "../../contracts/board";
import type { SpatialMetrics } from "../../contracts/analysis";
import type { PlayerRoundState } from "../../contracts/match";
import type { PatchData } from "../../contracts/patch";
import { standardBoard, type BoardSide } from "../../geometry";
import { effectiveRoles, unitValue } from "./composition";

export type WorldLane = "left" | "right";

export function worldLane(x: number): WorldLane {
  return x < 0 ? "left" : "right";
}

export function laneRegion(side: BoardSide, lane: WorldLane): BoardRectangle {
  const main = standardBoard.main[side];
  return { ...main, x: lane === "left" ? main.x : 0, width: main.width / 2 };
}

export function contains(
  region: BoardRectangle,
  point: { x: number; y: number },
) {
  return (
    point.x >= region.x &&
    point.x <= region.x + region.width &&
    point.y >= region.y &&
    point.y <= region.y + region.height
  );
}

export function positionedUnits(state: PlayerRoundState) {
  return state.units.filter(
    (unit) =>
      unit.positionKnown !== false && contains(standardBoard.bounds, unit),
  );
}

export function flankLane(side: BoardSide, point: { x: number; y: number }) {
  const lane = worldLane(point.x);
  return Math.abs(point.x) > standardBoard.main[side].width / 2 &&
    contains(standardBoard.flank[side][lane], point)
    ? lane
    : undefined;
}

export function spatialMetrics(
  state: PlayerRoundState,
  opponent: PlayerRoundState | undefined,
  side: BoardSide,
  roundNumber: number,
  patch: PatchData,
): SpatialMetrics | null {
  const units = positionedUnits(state);
  if (state.units.length && !units.length) return null;
  const enemy = opponent ? positionedUnits(opponent) : [];
  const enemySide = side === "north" ? "south" : "north";
  const flankOpen = roundNumber >= standardBoard.flankOpensInRound;
  let leftArmyValue = 0;
  let rightArmyValue = 0;
  let flankArmyValue = 0;
  let minChaffY = Infinity;
  let maxChaffY = -Infinity;
  for (const unit of units) {
    const value = unitValue(unit, patch);
    if (flankOpen && flankLane(side, unit)) flankArmyValue += value;
    else if (worldLane(unit.x) === "left") leftArmyValue += value;
    else rightArmyValue += value;
    if (effectiveRoles(unit, patch).has("chaff")) {
      minChaffY = Math.min(minChaffY, unit.y);
      maxChaffY = Math.max(maxChaffY, unit.y);
    }
  }
  const towerDefense =
    opponent && (!opponent.units.length || enemy.length)
      ? standardBoard.towers
          .filter((tower) => tower.side === side)
          .map((tower) => ({
            towerId: tower.id,
            friendlyValue: units.reduce(
              (sum, unit) =>
                Math.hypot(tower.x - unit.x, tower.y - unit.y) <=
                standardBoard.towerDefenseRadius
                  ? sum + unitValue(unit, patch)
                  : sum,
              0,
            ),
            opposingFlankValue: flankOpen
              ? enemy.reduce(
                  (sum, unit) =>
                    flankLane(enemySide, unit) === worldLane(tower.x)
                      ? sum + unitValue(unit, patch)
                      : sum,
                  0,
                )
              : 0,
          }))
      : [];
  return {
    leftArmyValue,
    rightArmyValue,
    flankArmyValue,
    chaffDepth: minChaffY === Infinity ? null : maxChaffY - minChaffY,
    towerDefense,
  };
}
