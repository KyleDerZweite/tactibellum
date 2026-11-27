import { z } from "zod";
import { boardHighlightSchema } from "./board";

const value = z.number().nonnegative();
const fraction = value.max(1);
const roundNumber = z.number().int().positive();
const id = z.string().min(1);

export const compositionRoleSchema = z.enum([
  "chaff",
  "chaff-clear",
  "single-target",
  "anti-air",
  "air",
  "giant",
]);

export const economyMetricsSchema = z.object({
  armyValue: value,
  armyValueDelta: z.number().nullable(),
  supplySpent: value,
  supplyEfficiency: z.number().nullable(),
  carryoverAfterRound: value.nullable(),
  deploymentsUsed: z.number().int().nonnegative(),
  deploymentCapacity: z.number().int().positive(),
  deploymentCapacityEstimated: z.boolean(),
  deploymentUtilization: value,
  techValue: value,
  techShare: fraction,
});

export const compositionMetricsSchema = z.object({
  shares: z.record(compositionRoleSchema, fraction),
  unknownUnits: z.number().int().nonnegative(),
});

export const spatialMetricsSchema = z.object({
  leftArmyValue: value,
  rightArmyValue: value,
  flankArmyValue: value,
  chaffDepth: value.nullable(),
  towerDefense: z.array(
    z.object({ towerId: id, friendlyValue: value, opposingFlankValue: value }),
  ),
});

export const playerMetricsSchema = z.object({
  economy: economyMetricsSchema,
  composition: compositionMetricsSchema,
  spatial: spatialMetricsSchema.nullable(),
});

export const ruleIdSchema = z.enum([
  "anti-air-gap",
  "chaff-ratio",
  "deployment-waste",
  "tech-overcommit",
  "flank-exposure",
  "lane-imbalance",
]);

export const findingSeveritySchema = z.enum(["info", "warning", "critical"]);

export const ruleFindingSchema = z.object({
  id,
  ruleId: ruleIdSchema,
  severity: findingSeveritySchema,
  roundNumber,
  playerId: id,
  title: z.string(),
  message: z.string(),
  formula: z.string(),
  evidence: z.record(z.string(), z.number()),
  highlight: boardHighlightSchema,
});

export const analysisReportSchema = z.object({
  schemaVersion: z.literal("1.0.0"),
  patchVersion: id,
  rounds: z.array(
    z.object({
      roundNumber,
      players: z.record(id, playerMetricsSchema),
    }),
  ),
  findings: z.array(ruleFindingSchema),
  notes: z.array(z.string()),
});

export type CompositionRole = z.infer<typeof compositionRoleSchema>;
export type EconomyMetrics = z.infer<typeof economyMetricsSchema>;
export type CompositionMetrics = z.infer<typeof compositionMetricsSchema>;
export type SpatialMetrics = z.infer<typeof spatialMetricsSchema>;
export type PlayerMetrics = z.infer<typeof playerMetricsSchema>;
export type RuleId = z.infer<typeof ruleIdSchema>;
export type FindingSeverity = z.infer<typeof findingSeveritySchema>;
export type RuleFinding = z.infer<typeof ruleFindingSchema>;
export type AnalysisReportV1 = z.infer<typeof analysisReportSchema>;
