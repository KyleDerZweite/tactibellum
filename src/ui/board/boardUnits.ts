import type { BoardHighlight } from "../../core/contracts/board";
import type {
  BoardUnit,
  MatchSnapshotV1,
  RoundSnapshot,
} from "../../core/contracts/match";
import { createGameCatalog } from "../../core/game-data";

export type Catalog = ReturnType<typeof createGameCatalog>;
export type UnitRef = BoardHighlight["units"][number];

export const diffLabels = {
  new: "New",
  moved: "Moved",
  upgraded: "Upgraded",
  teched: "Teched",
  removed: "Removed",
};

export const diffMarkers = {
  new: "+",
  moved: "M",
  upgraded: "↑",
  teched: "T",
  removed: "×",
};

export function unitKey({ playerId, instanceId }: UnitRef) {
  return JSON.stringify([playerId, instanceId]);
}

export function boardUnits(
  match: MatchSnapshotV1,
  round: RoundSnapshot,
  catalog: Catalog,
  showDiff: boolean,
) {
  return match.meta.players.flatMap((player, index) => {
    const state = round.players[player.id];
    if (!state) return [];
    const units = [
      ...state.units.map((unit) => ({ unit, removed: false })),
      ...(showDiff
        ? (state.removedUnits ?? []).map((unit) => ({ unit, removed: true }))
        : []),
    ];
    return units.map(({ unit, removed }) => {
      const entry = catalog.unit(unit.unitId);
      const techs = unit.techIds.map((id) => catalog.tech(unit.unitId, id));
      const roles = entry.isUnknown
        ? []
        : [
            ...new Set([
              ...entry.roles,
              ...(entry.isAir ? ["air"] : []),
              ...techs.flatMap((tech) =>
                tech.isUnknown ? [] : tech.addedRoles,
              ),
            ]),
          ];
      const baseRange = entry.isUnknown ? null : entry.range;
      return {
        unit,
        player,
        index,
        key: unitKey({ playerId: player.id, instanceId: unit.instanceId }),
        entry,
        techs,
        item: unit.itemId ? catalog.lookup("item", unit.itemId) : undefined,
        roles,
        range:
          baseRange === null
            ? null
            : Math.max(
                0,
                baseRange +
                  techs.reduce(
                    (sum, tech) =>
                      sum +
                      (tech.isUnknown ? 0 : (tech.statModifiers.range ?? 0)),
                    0,
                  ),
              ),
        diff: removed ? ("removed" as const) : unit.statusThisRound,
        removed,
      };
    });
  });
}

export type DisplayUnit = ReturnType<typeof boardUnits>[number];

export function unitLabel({ entry, player, unit, diff }: DisplayUnit) {
  return `${entry.name} #${unit.instanceId}, ${player.name}, level ${unit.level}${diff === "removed" ? ", removed" : ""}`;
}

export function knownPosition(unit: BoardUnit) {
  return unit.positionKnown !== false;
}
