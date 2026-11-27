import { z } from "zod";

const id = z.string().min(1);
const ids = z.array(id);
const roundNumber = z.number().int().nonnegative();
const positionSchema = z.object({ x: z.number(), y: z.number() });

export const boardUnitSchema = positionSchema.extend({
  instanceId: id,
  unitId: id,
  level: z.number().int().positive(),
  orientation: z.number().optional(),
  positionKnown: z.literal(false).optional(),
  techIds: ids,
  itemId: id.nullish(),
  statusThisRound: z.enum(["existing", "new", "moved", "upgraded", "teched"]),
});

export const actionRefSchema = z.object({
  id,
  name: z.string(),
  isUnknown: z.literal(true).optional(),
  position: positionSchema.optional(),
});

export const roundActionSchema = z.object({
  kind: z.enum([
    "buy",
    "move",
    "sell",
    "upgrade",
    "tech",
    "item",
    "device",
    "spell",
    "unlock",
    "tower",
    "specialist",
    "reinforcement",
    "finish",
    "undo",
    "unknown",
  ]),
  sourceType: z.string(),
  instanceId: id.optional(),
  unitId: id.optional(),
  ref: actionRefSchema.optional(),
  position: positionSchema.optional(),
  cost: z.number().nonnegative().optional(),
  undone: z.literal(true).optional(),
});

export const playerRoundStateSchema = z.object({
  playerId: id,
  specialistId: id.optional(),
  activeOfficerIds: ids.optional(),
  supplySpentThisRound: z.number().nonnegative(),
  checkpointSupply: z.number().nonnegative().optional(),
  supplyAvailable: z.number().nonnegative().optional(),
  deploymentSlots: z.number().int().positive().optional(),
  estimatedArmyValue: z.number().nonnegative(),
  deploymentsUsed: z.number().int().nonnegative(),
  unlockedUnits: ids,
  activeSpells: z.array(actionRefSchema),
  towerUpgrades: z.array(actionRefSchema),
  devices: z.array(actionRefSchema).optional(),
  units: z.array(boardUnitSchema),
  actions: z.array(roundActionSchema),
  removedUnits: z.array(boardUnitSchema).optional(),
});

export const roundSnapshotSchema = z.object({
  roundNumber,
  players: z.record(id, playerRoundStateSchema),
});

export const playerMetaSchema = z.object({
  id,
  name: z.string().min(1),
  team: id.optional(),
});

export const unknownIdOccurrenceSchema = z.object({
  kind: z.enum([
    "unit",
    "tech",
    "item",
    "device",
    "spell",
    "specialist",
    "tower",
    "blueprint",
    "reinforcement",
  ]),
  id,
  playerId: id,
  roundNumber,
});

export const replayWarningSchema = z.object({
  message: z.string(),
  playerId: id.optional(),
  roundNumber: roundNumber.optional(),
});

export const matchSnapshotSchema = z.object({
  schemaVersion: z.literal("1.0.0"),
  meta: z.object({
    fileName: z.string(),
    gameVersion: z.string().optional(),
    playedAt: z.string().optional(),
    mapId: id.optional(),
    mode: z.enum(["1v1", "2v2", "ffa", "unknown"]),
    players: z.array(playerMetaSchema).min(1),
    winnerPlayerId: id.nullish(),
    unknownIds: z.array(unknownIdOccurrenceSchema),
    warnings: z.array(replayWarningSchema).optional(),
  }),
  rounds: z.array(roundSnapshotSchema),
});

export type MatchSnapshotV1 = z.infer<typeof matchSnapshotSchema>;
export type RoundSnapshot = z.infer<typeof roundSnapshotSchema>;
export type PlayerRoundState = z.infer<typeof playerRoundStateSchema>;
export type PlayerMeta = z.infer<typeof playerMetaSchema>;
export type BoardUnit = z.infer<typeof boardUnitSchema>;
export type RoundAction = z.infer<typeof roundActionSchema>;
export type ActionRef = z.infer<typeof actionRefSchema>;
export type UnknownIdOccurrence = z.infer<typeof unknownIdOccurrenceSchema>;
export type ReplayWarning = z.infer<typeof replayWarningSchema>;
