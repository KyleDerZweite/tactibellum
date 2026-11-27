import { compositionMetrics, effectiveRoles } from "../metrics/composition";
import { playerRounds, supportsRules } from "../rounds";
import { finding, unitHighlights, type AnalysisRule } from "./shared";

export const AntiAirGapRule: AnalysisRule = (snapshot, patch) => {
  if (!supportsRules(snapshot)) return [];
  const findings = [];
  for (const round of playerRounds(snapshot, patch)) {
    const { state, playerId, opponent, composition } = round;
    if (!opponent || !composition.rolesComplete) continue;
    const enemy = compositionMetrics(opponent, patch);
    if (!enemy.rolesComplete) continue;
    const enemyAirValue = enemy.values.air;
    const enemyAirShare = enemy.metrics.shares.air;
    const antiAirShare = composition.metrics.shares["anti-air"];
    if (enemyAirValue < 300 || enemyAirShare < 0.25 || antiAirShare >= 0.2)
      continue;
    findings.push(
      finding(round, {
        ruleId: "anti-air-gap",
        severity: "warning",
        title: "Low anti-air coverage",
        message:
          "The opponent has substantial air value while few of your units can target air.",
        formula:
          "Enemy air value ≥ 300 and ≥ 25% of their board value, with friendly anti-air below 20% of friendly board value.",
        evidence: {
          enemyAirValue,
          enemyAirShare,
          antiAirShare,
          antiAirValue: composition.values["anti-air"],
        },
        highlight: {
          units: [
            ...unitHighlights(
              opponent.playerId,
              opponent.units.filter((unit) =>
                effectiveRoles(unit, patch).has("air"),
              ),
            ),
            ...unitHighlights(
              playerId,
              state.units.filter((unit) =>
                effectiveRoles(unit, patch).has("anti-air"),
              ),
            ),
          ],
        },
      }),
    );
  }
  return findings;
};
