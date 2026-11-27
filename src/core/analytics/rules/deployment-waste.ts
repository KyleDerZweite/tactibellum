import { playerRounds, supportsRules } from "../rounds";
import { finding, type AnalysisRule } from "./shared";

export const DeploymentWasteRule: AnalysisRule = (snapshot, patch) => {
  if (!supportsRules(snapshot)) return [];
  const findings = [];
  for (const round of playerRounds(snapshot, patch)) {
    const {
      carryoverAfterRound,
      deploymentsUsed,
      deploymentCapacity,
      deploymentCapacityEstimated,
    } = round.economy;
    const unusedSlots = deploymentCapacity - deploymentsUsed;
    const buys = round.state.actions.filter(
      (action) => action.kind === "buy" && !action.undone,
    );
    if (
      carryoverAfterRound === null ||
      carryoverAfterRound < 200 ||
      unusedSlots < 1 ||
      buys.length !== deploymentsUsed ||
      buys.some((action) => !action.unitId || !action.instanceId)
    )
      continue;
    findings.push(
      finding(round, {
        ruleId: "deployment-waste",
        severity: "info",
        title: deploymentCapacityEstimated
          ? "Estimated unused deployment slot"
          : "Unused deployment slot",
        message:
          "The next ordinary checkpoint recorded at least 200 supply carried over after this round.",
        formula:
          "Recorded slot capacity (or two-slot estimate) − deployments used ≥ 1, and next adjacent ordinary checkpoint supply ≥ 200. Each live buy must match a counted deployment with a unit type and instance.",
        evidence: {
          carryoverAfterRound,
          deploymentsUsed,
          deploymentCapacity,
          unusedSlots,
          deploymentCapacityEstimated: Number(deploymentCapacityEstimated),
        },
        highlight: { units: [] },
      }),
    );
  }
  return findings;
};
