import type { PatchData } from "../contracts/patch";
import type { ScenarioUnit } from "../contracts/scenario";
import { patchTech, patchUnit } from "../game-data";

export type BoardPoint = { x: number; y: number };

export function estimateArrival(
  unit: ScenarioUnit,
  goal: BoardPoint,
  patch: PatchData,
) {
  const definition = patchUnit(patch, unit.unitId);
  if (!definition) return undefined;
  const techs = unit.techIds.map((id) => patchTech(patch, unit.unitId, id));
  const speed =
    definition.speed === null
      ? null
      : definition.speed +
        techs.reduce((sum, tech) => sum + (tech?.statModifiers.speed ?? 0), 0);
  const range =
    definition.range === null
      ? null
      : Math.max(
          0,
          definition.range +
            techs.reduce(
              (sum, tech) => sum + (tech?.statModifiers.range ?? 0),
              0,
            ),
        );
  const distance = Math.hypot(goal.x - unit.x, goal.y - unit.y);
  function elapsed(metres: number) {
    if (metres === 0) return 0;
    return speed !== null && speed > 0 ? metres / speed : null;
  }
  return {
    distance,
    speed,
    range,
    arrival: elapsed(distance),
    inRange: range === null ? null : elapsed(Math.max(0, distance - range)),
    simplifiedLoadout:
      Boolean(unit.itemId) ||
      techs.some(
        (tech) =>
          !tech ||
          (tech.statModifiers.speed === undefined &&
            tech.statModifiers.range === undefined),
      ),
  };
}
