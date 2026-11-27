import { standardBoard } from "../../geometry";
import { unitValue } from "../metrics/composition";
import { flankLane, spatialMetrics, worldLane } from "../metrics/spatial";
import {
  finding,
  spatialPairs,
  unitHighlights,
  type AnalysisRule,
} from "./shared";

export const FlankExposureRule: AnalysisRule = (snapshot, patch) => {
  const findings = [];
  for (const round of spatialPairs(snapshot, patch)) {
    const { roundNumber, side, enemySide, enemy, opponentId, state, opponent } =
      round;
    if (roundNumber < standardBoard.flankOpensInRound) continue;
    const spatial = spatialMetrics(state, opponent, side, roundNumber, patch);
    for (const defense of spatial?.towerDefense ?? []) {
      const tower = standardBoard.towers.find(
        ({ id }) => id === defense.towerId,
      );
      if (!tower) continue;
      const lane = worldLane(tower.x);
      const { friendlyValue, opposingFlankValue } = defense;
      const flankUnits = enemy.filter(
        (unit) => flankLane(enemySide, unit) === lane,
      );
      const frontalUnits = enemy.filter(
        (unit) => worldLane(unit.x) === lane && !flankLane(enemySide, unit),
      );
      const opposingLaneValue = frontalUnits.reduce(
        (sum, unit) => sum + unitValue(unit, patch),
        0,
      );
      const otherTowerFriendlyValue =
        spatial?.towerDefense.find(({ towerId }) => towerId !== tower.id)
          ?.friendlyValue ?? 0;
      const hasFlankThreat =
        opposingFlankValue >= 300 && friendlyValue < opposingFlankValue / 2;
      const hasTowerGap =
        opposingLaneValue >= 300 &&
        otherTowerFriendlyValue >= 300 &&
        friendlyValue < otherTowerFriendlyValue / 4;
      if (!hasFlankThreat && !hasTowerGap) continue;
      findings.push(
        finding(
          round,
          {
            ruleId: "flank-exposure",
            severity: "warning",
            title: `${tower.kind} exposed on the world ${lane}`,
            message: hasFlankThreat
              ? "Enemy flank value exceeds twice the friendly value near this tower."
              : "The opponent has value on this half, while nearby friendly value is concentrated around your other tower.",
            formula: hasFlankThreat
              ? "Enemy flank value on this world half ≥ 300 and friendly value within 100 m of the tower < half that value."
              : "Enemy non-flank value on this world half ≥ 300, other tower defense ≥ 300, and this tower defense < 25% of the other tower defense. Defense counts friendly value within 100 m.",
            evidence: {
              friendlyValue,
              opposingFlankValue,
              opposingLaneValue,
              otherTowerFriendlyValue,
            },
            highlight: {
              region: hasFlankThreat
                ? standardBoard.flank[enemySide][lane]
                : {
                    x: tower.x - standardBoard.towerDefenseRadius,
                    y: tower.y - standardBoard.towerDefenseRadius,
                    width: 2 * standardBoard.towerDefenseRadius,
                    height: 2 * standardBoard.towerDefenseRadius,
                  },
              units: unitHighlights(
                opponentId,
                hasFlankThreat ? flankUnits : frontalUnits,
              ),
            },
          },
          tower.id,
        ),
      );
    }
  }
  return findings;
};
