import type { RuleFinding } from "../../contracts/analysis";
import type { BoardUnit, MatchSnapshotV1 } from "../../contracts/match";
import type { PatchData } from "../../contracts/patch";
import { patchUnit } from "../../game-data";
import { boardSide, hasStandardBoard } from "../../geometry";
import { analysisRounds, supportsRules } from "../rounds";
import { positionedUnits } from "../metrics/spatial";

type FindingDetails = Omit<RuleFinding, "id" | "roundNumber" | "playerId">;

export function finding(
  { roundNumber, playerId }: { roundNumber: number; playerId: string },
  details: FindingDetails,
  qualifier?: string,
): RuleFinding {
  return {
    id: JSON.stringify([
      roundNumber,
      playerId,
      details.ruleId,
      qualifier ?? null,
    ]),
    roundNumber,
    playerId,
    ...details,
  };
}

export function unitHighlights(playerId: string, units: BoardUnit[]) {
  return units.map(({ instanceId }) => ({ playerId, instanceId }));
}

export type AnalysisRule = (
  snapshot: MatchSnapshotV1,
  patch: PatchData,
) => RuleFinding[];

export function* spatialPairs(snapshot: MatchSnapshotV1, patch: PatchData) {
  if (!supportsRules(snapshot) || !hasStandardBoard(snapshot)) return;
  const players = snapshot.meta.players.map(({ id }) => ({
    id,
    side: boardSide(snapshot, id),
  }));
  for (const { roundNumber, players: states } of analysisRounds(snapshot)) {
    for (const [index, { id: playerId, side }] of players.entries()) {
      const { id: opponentId, side: enemySide } = players[1 - index];
      const state = states[playerId];
      const opponent = states[opponentId];
      if (!state || !opponent) continue;
      const friendly = positionedUnits(state);
      const enemy = positionedUnits(opponent);
      if (
        friendly.length !== state.units.length ||
        enemy.length !== opponent.units.length ||
        [...friendly, ...enemy].some((unit) => !patchUnit(patch, unit.unitId))
      )
        continue;
      yield {
        roundNumber,
        playerId,
        side,
        enemySide,
        opponentId,
        friendly,
        enemy,
        state,
        opponent,
      };
    }
  }
}
