import { patchUnit } from "../../game-data";
import { compositionMetrics, effectiveRoles } from "../metrics/composition";
import { playerRounds, supportsRules } from "../rounds";
import { finding, unitHighlights, type AnalysisRule } from "./shared";

export const TechOvercommitRule: AnalysisRule = (snapshot, patch) => {
  if (!supportsRules(snapshot)) return [];
  const findings = [];
  for (const round of playerRounds(snapshot, patch)) {
    const { playerId, state, opponent, composition, economy, tech } = round;
    if (
      !opponent ||
      !tech.complete ||
      !composition.rolesComplete ||
      economy.techShare < 0.2
    )
      continue;
    const enemy = compositionMetrics(opponent, patch);
    if (!enemy.rolesComplete) continue;
    for (const [unitId, unitTechValue] of tech.byUnit) {
      const definition = patchUnit(patch, unitId);
      if (!definition || unitTechValue < 400) continue;
      const techConcentration = unitTechValue / tech.total;
      if (techConcentration < 0.6) continue;
      const units = state.units.filter((unit) => unit.unitId === unitId);
      const counterRole = units.every((unit) =>
        effectiveRoles(unit, patch).has("air"),
      )
        ? "anti-air"
        : "chaff";
      if (
        !units.length ||
        (counterRole === "chaff" &&
          !units.every((unit) => {
            const roles = effectiveRoles(unit, patch);
            return roles.has("single-target") && !roles.has("chaff-clear");
          }))
      )
        continue;
      const enemyCounterShare = enemy.metrics.shares[counterRole];
      if (enemyCounterShare < 0.2) continue;
      findings.push(
        finding(
          round,
          {
            ruleId: "tech-overcommit",
            severity: "warning",
            title: "Concentrated tech investment",
            message: `Tech spending is concentrated on ${definition.name}. The opposing board has substantial ${counterRole} value.`,
            formula:
              "One deployed unit type has ≥ 400 tech value and ≥ 60% of researched tech value. Tech is ≥ 20% of army plus tech value. Enemy anti-air against air, or chaff against single-target units without chaff-clear, is ≥ 20% of enemy board value.",
            evidence: {
              unitTechValue,
              totalTechValue: tech.total,
              techConcentration,
              techShare: economy.techShare,
              enemyCounterShare,
              enemyCounterValue: enemy.values[counterRole],
            },
            highlight: {
              units: [
                ...unitHighlights(playerId, units),
                ...unitHighlights(
                  opponent.playerId,
                  opponent.units.filter((unit) =>
                    effectiveRoles(unit, patch).has(counterRole),
                  ),
                ),
              ],
            },
          },
          unitId,
        ),
      );
    }
  }
  return findings;
};
