import { unitValue } from "../metrics/composition";
import { flankLane, laneRegion, worldLane } from "../metrics/spatial";
import { standardBoard } from "../../geometry";
import {
  finding,
  spatialPairs,
  unitHighlights,
  type AnalysisRule,
} from "./shared";

export const LaneImbalanceRule: AnalysisRule = (snapshot, patch) => {
  const findings = [];
  for (const round of spatialPairs(snapshot, patch)) {
    const { roundNumber, side, enemySide, friendly, enemy, opponentId } = round;
    const flankOpen = roundNumber >= standardBoard.flankOpensInRound;
    const ownMain = friendly.filter(
      (unit) => !flankOpen || !flankLane(side, unit),
    );
    const enemyMain = enemy.filter(
      (unit) => !flankOpen || !flankLane(enemySide, unit),
    );
    const total = ownMain.reduce(
      (sum, unit) => sum + unitValue(unit, patch),
      0,
    );
    if (total < 400) continue;
    for (const lane of ["left", "right"] as const) {
      const ownValue = ownMain
        .filter((unit) => worldLane(unit.x) === lane)
        .reduce((sum, unit) => sum + unitValue(unit, patch), 0);
      const pressure = enemyMain.filter((unit) => worldLane(unit.x) === lane);
      const enemyValue = pressure.reduce(
        (sum, unit) => sum + unitValue(unit, patch),
        0,
      );
      const otherLaneShare = (total - ownValue) / total;
      const laneValueGap = enemyValue - ownValue;
      if (otherLaneShare < 0.8 || laneValueGap < 300) continue;
      findings.push(
        finding(round, {
          ruleId: "lane-imbalance",
          severity: "warning",
          title: `Open world ${lane} lane`,
          message:
            "Most of your non-flank value is on the other half, while the opponent has a value advantage here.",
          formula:
            "Friendly non-flank value ≥ 400, ≥ 80% of it on the opposite world half, and enemy non-flank value exceeds friendly value here by ≥ 300.",
          evidence: {
            otherLaneShare,
            friendlyLaneValue: ownValue,
            enemyLaneValue: enemyValue,
            laneValueGap,
            friendlyNonFlankValue: total,
          },
          highlight: {
            region: laneRegion(side, lane),
            units: unitHighlights(opponentId, pressure),
          },
        }),
      );
    }
  }
  return findings;
};
