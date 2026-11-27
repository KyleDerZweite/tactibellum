import type { EconomyMetrics } from "../../contracts/analysis";
import type { PlayerRoundState, RoundAction } from "../../contracts/match";
import type { PatchData } from "../../contracts/patch";

import { patchTech } from "../../game-data";

type Research = Map<string, Set<string>>;

export function recordResearch(research: Research, state: PlayerRoundState) {
  function record(unitId: string, techId: string) {
    const ids = research.get(unitId) ?? new Set<string>();
    ids.add(techId);
    research.set(unitId, ids);
  }
  for (const unit of [...state.units, ...(state.removedUnits ?? [])])
    for (const id of unit.techIds) record(unit.unitId, id);

  let complete = true;
  for (const action of state.actions) {
    if (action.undone || action.kind !== "tech") continue;
    if (action.unitId && action.ref) record(action.unitId, action.ref.id);
    else complete = false;
  }
  return complete;
}

export function researchCosts(research: Research, patch: PatchData) {
  let complete = true;
  let total = 0;
  const byUnit = new Map<string, number>();
  for (const [unitId, ids] of research) {
    let value = 0;
    for (const id of ids) {
      const cost = patchTech(patch, unitId, id)?.cost;
      if (cost == null) complete = false;
      else value += cost;
    }
    byUnit.set(unitId, value);
    total += value;
  }
  return { total, byUnit, complete };
}

const pricedActions = new Set<RoundAction["kind"]>([
  "buy",
  "upgrade",
  "tech",
  "unlock",
  "tower",
  "device",
  "spell",
]);

export function economyMetrics(
  state: PlayerRoundState,
  previous: PlayerRoundState | undefined,
  next: PlayerRoundState | undefined,
  techValue: number,
): EconomyMetrics {
  const armyValue = state.estimatedArmyValue;
  const armyValueDelta = previous
    ? armyValue - previous.estimatedArmyValue
    : null;
  const supplySpent = state.supplySpentThisRound;
  const spendKnown = state.actions.every(
    (action) =>
      action.undone ||
      (action.kind !== "unknown" &&
        (!pricedActions.has(action.kind) || action.cost !== undefined)),
  );
  const deploymentCapacity = state.deploymentSlots ?? 2;
  return {
    armyValue,
    armyValueDelta,
    supplySpent,
    supplyEfficiency:
      armyValueDelta !== null && supplySpent > 0 && spendKnown
        ? armyValueDelta / supplySpent
        : null,
    carryoverAfterRound:
      next?.supplyAvailable === undefined
        ? (next?.checkpointSupply ?? null)
        : null,
    deploymentsUsed: state.deploymentsUsed,
    deploymentCapacity,
    deploymentCapacityEstimated: state.deploymentSlots === undefined,
    deploymentUtilization: state.deploymentsUsed / deploymentCapacity,
    techValue,
    techShare:
      armyValue + techValue > 0 ? techValue / (armyValue + techValue) : 0,
  };
}
