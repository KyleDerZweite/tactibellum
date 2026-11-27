import type { analysisFormulas } from "../../core/analytics/formulas";
import type {
  CompositionRole,
  PlayerMetrics,
  SpatialMetrics,
} from "../../core/contracts/analysis";

type Lane = "leftArmyValue" | "rightArmyValue" | "flankArmyValue";
type TowerComponent = "friendlyValue" | "opposingFlankValue";
export const roles: Record<CompositionRole, string> = {
  chaff: "Chaff",
  "chaff-clear": "Chaff clear",
  "single-target": "Single target",
  "anti-air": "Anti-air",
  air: "Air",
  giant: "Giant",
};

export const lanes: Record<Lane, string> = {
  leftArmyValue: "Left",
  rightArmyValue: "Right",
  flankArmyValue: "Flank",
};

export const towerComponents: Record<TowerComponent, string> = {
  friendlyValue: "Friendly defense",
  opposingFlankValue: "Opposing flank",
};

export function towerKind(towerId: string) {
  return towerId.replace(/^(north|south)-/, "");
}

interface MetricOptions {
  role: CompositionRole;
  lane: Lane;
  tower: string;
  towerComponent: TowerComponent;
}

interface Metric {
  label: string;
  unit?: "percent" | "metres";
  value: (metrics: PlayerMetrics, options: MetricOptions) => number | null;
}

function towerValue(
  spatial: SpatialMetrics | null,
  { tower, towerComponent }: MetricOptions,
) {
  return (
    spatial?.towerDefense.find(({ towerId }) => towerKind(towerId) === tower)?.[
      towerComponent
    ] ?? null
  );
}

export const metrics = {
  armyValue: { label: "Army value", value: (data) => data.economy.armyValue },
  armyValueDelta: {
    label: "Army value change",
    value: (data) => data.economy.armyValueDelta,
  },
  supplySpent: {
    label: "Supply spent",
    value: (data) => data.economy.supplySpent,
  },
  carryoverAfterRound: {
    label: "Supply carried over",
    value: (data) => data.economy.carryoverAfterRound,
  },
  supplyEfficiency: {
    label: "Supply efficiency",
    unit: "percent",
    value: (data) => data.economy.supplyEfficiency,
  },
  deploymentUtilization: {
    label: "Deployment utilization",
    unit: "percent",
    value: (data) => data.economy.deploymentUtilization,
  },
  techValue: {
    label: "Tech investment",
    value: (data) => data.economy.techValue,
  },
  techShare: {
    label: "Tech share",
    unit: "percent",
    value: (data) => data.economy.techShare,
  },
  composition: {
    label: "Role share",
    unit: "percent",
    value: (data, { role }) => data.composition.shares[role],
  },
  spatial: {
    label: "Lane and flank value",
    value: (data, { lane }) => data.spatial?.[lane] ?? null,
  },
  towerDefense: {
    label: "Tower exposure",
    value: (data, options) => towerValue(data.spatial, options),
  },
  chaffDepth: {
    label: "Chaff depth",
    unit: "metres",
    value: (data) => data.spatial?.chaffDepth ?? null,
  },
} satisfies Partial<Record<keyof typeof analysisFormulas, Metric>>;

const numbers = new Intl.NumberFormat("en", { maximumFractionDigits: 2 });
const percentages = new Intl.NumberFormat("en", {
  style: "percent",
  maximumFractionDigits: 1,
});

export function formatMetric(value: number | null, unit: Metric["unit"]) {
  if (value === null) return "Unavailable";
  if (unit === "percent") return percentages.format(value);
  return unit === "metres"
    ? `${numbers.format(value)} m`
    : numbers.format(value);
}
