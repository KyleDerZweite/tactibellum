import type { MatchSnapshotV1, PlayerRoundState } from "../contracts/match";
import type { PatchData } from "../contracts/patch";
import { compositionMetrics } from "./metrics/composition";
import {
  economyMetrics,
  recordResearch,
  researchCosts,
} from "./metrics/economy";

export function analysisRounds(snapshot: MatchSnapshotV1) {
  return snapshot.rounds
    .filter((round) => round.roundNumber > 0)
    .sort((a, b) => a.roundNumber - b.roundNumber);
}

export function supportsRules(snapshot: MatchSnapshotV1) {
  return snapshot.meta.mode === "1v1" && snapshot.meta.players.length === 2;
}

export function* playerRounds(snapshot: MatchSnapshotV1, patch: PatchData) {
  const rounds = analysisRounds(snapshot);
  const byNumber = new Map(rounds.map((round) => [round.roundNumber, round]));
  const researchByPlayer = new Map<string, Map<string, Set<string>>>();
  const incompleteResearch = new Set<string>();
  for (const { roundNumber, players } of rounds) {
    for (const playerId of Object.keys(players).sort()) {
      const state = players[playerId];
      const opponentId = snapshot.meta.players.find(
        ({ id }) => id !== playerId,
      )?.id;
      const opponent: PlayerRoundState | undefined =
        opponentId === undefined ? undefined : players[opponentId];
      const previous = byNumber.get(roundNumber - 1)?.players[playerId];
      const next = byNumber.get(roundNumber + 1)?.players[playerId];
      const research =
        researchByPlayer.get(playerId) ?? new Map<string, Set<string>>();
      researchByPlayer.set(playerId, research);
      if (!recordResearch(research, state)) incompleteResearch.add(playerId);
      const tech = researchCosts(research, patch);
      yield {
        roundNumber,
        playerId,
        state,
        opponent,
        composition: compositionMetrics(state, patch),
        economy: economyMetrics(state, previous, next, tech.total),
        tech: {
          ...tech,
          complete: tech.complete && !incompleteResearch.has(playerId),
        },
      };
    }
  }
}
