import type {
  AnalysisReportV1,
  PlayerMetrics,
} from "../../core/contracts/analysis";
import type { MatchSnapshotV1 } from "../../core/contracts/match";

export const match: MatchSnapshotV1 = {
  schemaVersion: "1.0.0",
  meta: {
    fileName: "analysis.grbr",
    mode: "1v1",
    players: [
      { id: "p1", name: "Ada" },
      { id: "p2", name: "Lin" },
    ],
    winnerPlayerId: "p1",
    unknownIds: [],
  },
  rounds: [2, 5, 8].map((roundNumber) => ({ roundNumber, players: {} })),
};

const metrics: PlayerMetrics = {
  economy: {
    armyValue: 400,
    armyValueDelta: null,
    supplySpent: 200,
    supplyEfficiency: null,
    carryoverAfterRound: null,
    deploymentsUsed: 1,
    deploymentCapacity: 2,
    deploymentCapacityEstimated: true,
    deploymentUtilization: 0.5,
    techValue: 0,
    techShare: 0,
  },
  composition: {
    shares: {
      chaff: 0.25,
      "chaff-clear": 0.75,
      "single-target": 0,
      "anti-air": 0,
      air: 0,
      giant: 0,
    },
    unknownUnits: 0,
  },
  spatial: null,
};

export const report: AnalysisReportV1 = {
  schemaVersion: "1.0.0",
  patchVersion: "959",
  rounds: [
    { roundNumber: 2, players: { p1: metrics, p2: metrics } },
    {
      roundNumber: 8,
      players: {
        p1: {
          ...metrics,
          economy: { ...metrics.economy, armyValue: 760, armyValueDelta: 360 },
        },
      },
    },
  ],
  findings: [
    {
      id: "gap",
      ruleId: "anti-air-gap",
      severity: "critical",
      roundNumber: 2,
      playerId: "p1",
      title: "Anti-air gap",
      message: "The opposing air value exceeds available anti-air.",
      formula: "Air value > anti-air value",
      evidence: { opposingAirValue: 450 },
      highlight: { units: [{ playerId: "p2", instanceId: "air-1" }] },
    },
    {
      id: "chaff",
      ruleId: "chaff-ratio",
      severity: "warning",
      roundNumber: 8,
      playerId: "p2",
      title: "Low chaff share",
      message: "The chaff share falls below the threshold.",
      formula: "Chaff share < 15%",
      evidence: { chaffShare: 0.1 },
      highlight: { units: [] },
    },
  ],
  notes: [],
};
