import { compositionRoleSchema } from "../../contracts/analysis";
import type { CompositionMetrics } from "../../contracts/analysis";
import type { BoardUnit, PlayerRoundState } from "../../contracts/match";
import type { PatchData } from "../../contracts/patch";

import { patchTech, patchUnit } from "../../game-data";

export function unitValue(unit: BoardUnit, patch: PatchData) {
  return (
    (patchUnit(patch, unit.unitId)?.cost ?? 0) * (1 + (unit.level - 1) / 2)
  );
}

export function effectiveRoles(unit: BoardUnit, patch: PatchData) {
  const catalog = patchUnit(patch, unit.unitId);
  const roles = new Set(catalog?.roles);
  if (catalog?.isAir) roles.add("air");
  if (catalog?.canTargetAir) roles.add("anti-air");
  for (const id of unit.techIds)
    for (const role of patchTech(patch, unit.unitId, id)?.addedRoles ?? [])
      roles.add(role);
  return roles;
}

export function compositionMetrics(state: PlayerRoundState, patch: PatchData) {
  const shares: CompositionMetrics["shares"] = {
    chaff: 0,
    "chaff-clear": 0,
    "single-target": 0,
    "anti-air": 0,
    air: 0,
    giant: 0,
  };
  let total = 0;
  let unknownUnits = 0;
  let rolesComplete = true;
  for (const unit of state.units) {
    const catalog = patchUnit(patch, unit.unitId);
    if (!catalog) unknownUnits++;
    if (
      !catalog ||
      unit.techIds.some((id) => !patchTech(patch, unit.unitId, id))
    )
      rolesComplete = false;
    const value = unitValue(unit, patch);
    total += value;
    const roles = effectiveRoles(unit, patch);
    for (const role of compositionRoleSchema.options)
      if (roles.has(role)) shares[role] += value;
  }
  const values = { ...shares };
  if (total > 0)
    for (const role of compositionRoleSchema.options) shares[role] /= total;
  return { metrics: { shares, unknownUnits }, total, values, rolesComplete };
}
