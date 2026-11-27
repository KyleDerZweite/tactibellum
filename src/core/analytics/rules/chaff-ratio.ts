import { effectiveRoles } from "../metrics/composition";
import { playerRounds, supportsRules } from "../rounds";
import { finding, unitHighlights, type AnalysisRule } from "./shared";

export const ChaffRatioRule: AnalysisRule = (snapshot, patch) => {
  if (!supportsRules(snapshot)) return [];
  const findings = [];
  for (const round of playerRounds(snapshot, patch)) {
    const { roundNumber, playerId, state, composition } = round;
    if (
      roundNumber < 3 ||
      !composition.rolesComplete ||
      composition.total === 0
    )
      continue;
    const chaffShare = composition.metrics.shares.chaff;
    const low = chaffShare < 0.15;
    if (!low && chaffShare <= 0.5) continue;
    findings.push(
      finding(round, {
        ruleId: "chaff-ratio",
        severity: "info",
        title: low ? "Low chaff share" : "High chaff share",
        message: low
          ? "Chaff makes up less than 15% of your board value."
          : "Chaff makes up more than half of your board value.",
        formula:
          "From round 3, chaff value ÷ board value is below 15% or above 50%.",
        evidence: {
          chaffShare,
          chaffValue: composition.values.chaff,
          boardValue: composition.total,
        },
        highlight: {
          units: unitHighlights(
            playerId,
            state.units.filter((unit) =>
              effectiveRoles(unit, patch).has("chaff"),
            ),
          ),
        },
      }),
    );
  }
  return findings;
};
