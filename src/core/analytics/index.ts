import type { AnalysisReportV1, PlayerMetrics } from "../contracts/analysis";
import type { MatchSnapshotV1 } from "../contracts/match";
import type { PatchData } from "../contracts/patch";
import { boardSide, hasStandardBoard } from "../geometry";
import { spatialMetrics } from "./metrics/spatial";
import {
  analysisRounds,
  playerRounds,
  ruleSupportNote,
  supportsRules,
} from "./rounds";
import { AntiAirGapRule } from "./rules/anti-air-gap";
import { ChaffRatioRule } from "./rules/chaff-ratio";
import { DeploymentWasteRule } from "./rules/deployment-waste";
import { TechOvercommitRule } from "./rules/tech-overcommit";
import { FlankExposureRule } from "./rules/flank-exposure";
import { LaneImbalanceRule } from "./rules/lane-imbalance";

export { analysisFormulas } from "./formulas";
export {
  AntiAirGapRule,
  ChaffRatioRule,
  DeploymentWasteRule,
  TechOvercommitRule,
  FlankExposureRule,
  LaneImbalanceRule,
};

const rules = [
  AntiAirGapRule,
  ChaffRatioRule,
  DeploymentWasteRule,
  TechOvercommitRule,
  FlankExposureRule,
  LaneImbalanceRule,
];

export function analyzeMatch(
  snapshot: MatchSnapshotV1,
  patchData: PatchData,
): AnalysisReportV1 {
  const standard = hasStandardBoard(snapshot);
  const sides = new Map(
    snapshot.meta.players.map(({ id }) => [id, boardSide(snapshot, id)]),
  );
  const metrics = new Map(
    analysisRounds(snapshot).map(({ roundNumber }) => [
      roundNumber,
      new Map<string, PlayerMetrics>(),
    ]),
  );
  for (const round of playerRounds(snapshot, patchData)) {
    const { roundNumber, playerId, state, opponent, economy, composition } =
      round;
    const side = sides.get(playerId);
    metrics.get(roundNumber)?.set(playerId, {
      economy,
      composition: composition.metrics,
      spatial:
        standard && side
          ? spatialMetrics(state, opponent, side, roundNumber, patchData)
          : null,
    });
  }

  const notes = [
    "Deployment capacity uses recorded slots where present. The two-slot fallback does not account for officer, card, or temporary slot effects.",
    "Tech value counts observed research with known prices. Missing prices understate tech investment.",
    "Composition uses known unit value. A unit can count toward several roles, and unknown tech can leave roles incomplete. An empty known board has zero shares.",
    "Spatial values exclude unknown costs and unavailable or out-of-bounds coordinates. Spatial metrics require a standard 1v1 map and, for a nonempty board, at least one positioned friendly unit.",
    "Tower defense is unavailable if the opposing state is missing or all its units lack usable positions. Chaff depth is unavailable without positioned chaff. Partial positions can understate spatial values.",
  ];
  if (!supportsRules(snapshot)) notes.push(ruleSupportNote);
  else if (!standard)
    notes.push("Spatial metrics and findings are unavailable for this map.");

  return {
    schemaVersion: "1.0.0",
    patchVersion: patchData.version,
    rounds: [...metrics].map(([roundNumber, players]) => ({
      roundNumber,
      players: Object.fromEntries(players),
    })),
    findings: rules
      .flatMap((rule) => rule(snapshot, patchData))
      .sort((a, b) => {
        if (a.roundNumber !== b.roundNumber)
          return a.roundNumber - b.roundNumber;
        return a.id < b.id ? -1 : Number(a.id > b.id);
      }),
    notes,
  };
}
