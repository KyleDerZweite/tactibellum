import type { MatchSnapshotV1 } from "../contracts/match";
import { scenarioSchema, scenarioUnitSchema } from "../contracts/scenario";
import { boardSide, hasStandardBoard } from "../geometry";

export function scenarioFromReplay(
  match: MatchSnapshotV1,
  roundNumber: number,
  patchVersion: string,
) {
  const round = match.rounds.find((entry) => entry.roundNumber === roundNumber);
  if (!round || !hasStandardBoard(match))
    throw new Error("Choose a round from a standard 1v1 replay.");
  let seen = 0;
  const units = match.meta.players.flatMap(({ id }) => {
    const side = boardSide(match, id);
    return (round.players[id]?.units ?? []).flatMap((unit) => {
      const candidate = scenarioUnitSchema.safeParse({
        id: "u" + ++seen,
        side,
        unitId: unit.unitId,
        x: unit.x,
        y: unit.y,
        orientation: unit.orientation,
        level: unit.level,
        techIds: [...new Set(unit.techIds)],
        itemId: unit.itemId ?? undefined,
      });
      return candidate.success && unit.positionKnown !== false
        ? [candidate.data]
        : [];
    });
  });
  return {
    scenario: scenarioSchema.parse({ version: 1, patchVersion, units }),
    skipped: seen - units.length,
  };
}
