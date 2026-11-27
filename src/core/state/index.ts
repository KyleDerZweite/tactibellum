import { matchSnapshotSchema } from "../contracts/match";
import type {
  MatchSnapshotV1,
  PlayerRoundState,
  ReplayWarning,
  UnknownIdOccurrence,
} from "../contracts/match";
import type { PatchData } from "../contracts/patch";
import { createGameCatalog } from "../game-data";
import type { RawReplay } from "../parser";
import { number, string } from "../parser/xml-fields";
import { reduceRound } from "./reduce-round";

export function reconstructMatch(
  raw: RawReplay,
  patch?: PatchData,
): MatchSnapshotV1 {
  const catalog = createGameCatalog(patch);
  const warnings: ReplayWarning[] = [];
  const unknownIds = new Map<string, UnknownIdOccurrence>();
  const rounds = new Map(
    raw.roundNumbers
      .filter((round) => round > 0)
      .map(
        (roundNumber) =>
          [roundNumber, new Map<string, PlayerRoundState>()] as const,
      ),
  );
  for (const player of raw.players) {
    let previous: PlayerRoundState | undefined;
    for (const [roundIndex, round] of player.rounds.entries()) {
      const { roundNumber } = round;
      const warn = (message: string) =>
        warnings.push({ message, playerId: player.id, roundNumber });
      const state = reduceRound(
        player.id,
        round,
        previous,
        player.rounds[roundIndex + 1],
        {
          catalog,
          warn,
          resolve(kind, id, unitId) {
            const result = catalog.lookup(kind, id, unitId);
            if (result.isUnknown)
              unknownIds.set(
                JSON.stringify([kind, id, player.id, roundNumber]),
                { kind, id, playerId: player.id, roundNumber },
              );
            return {
              id,
              name: result.name,
              isUnknown: result.isUnknown ? true : undefined,
            };
          },
        },
      );
      if (roundNumber === 0) continue;
      rounds.get(roundNumber)?.set(player.id, state);
      previous = state;
    }
  }
  for (const [roundNumber, players] of rounds) {
    for (const player of raw.players) {
      if (!players.has(player.id))
        warnings.push({
          message: "Player round is missing from the replay.",
          roundNumber,
          playerId: player.id,
        });
    }
  }
  const modeId = string(raw.battleInfo.MatchMode);
  const mode =
    modeId === "VS_1_1"
      ? "1v1"
      : modeId === "VS_2_2"
        ? "2v2"
        : modeId === "FFA" || modeId === "VS_4_Scuffle"
          ? "ffa"
          : "unknown";
  if (mode !== "1v1" || raw.players.length !== 2)
    warnings.push({
      message: "Only 1v1 replay reconstruction has been verified.",
    });
  if (!rounds.size)
    warnings.push({ message: "The replay contains no deployment rounds." });
  const timestamp = number(raw.battleInfo.StartTime);
  const date =
    !timestamp || timestamp < 0 ? undefined : new Date(timestamp * 1000);

  return matchSnapshotSchema.parse({
    schemaVersion: "1.0.0",
    meta: {
      fileName: raw.fileName,
      gameVersion: raw.version,
      playedAt:
        date && Number.isFinite(date.getTime())
          ? date.toISOString()
          : undefined,
      mapId: string(raw.battleInfo.MapID),
      mode,
      players: raw.players.map(({ id, name, team }) => ({ id, name, team })),
      unknownIds: [...unknownIds.values()],
      warnings,
    },
    rounds: [...rounds].map(([roundNumber, players]) => ({
      roundNumber,
      players: Object.fromEntries(players),
    })),
  } satisfies MatchSnapshotV1);
}
