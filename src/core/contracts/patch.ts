import { z } from "zod";

const catalogEntrySchema = z.object({
  name: z.string().min(1),
  cost: z.number().nonnegative().nullable(),
});

const techSchema = catalogEntrySchema.extend({
  statModifiers: z.record(z.string(), z.number()),
  addedRoles: z.array(z.string()),
});

export const patchUnitSchema = catalogEntrySchema.extend({
  id: z.string().min(1),
  cost: z.number().nonnegative(),
  unlockCost: z.number().nonnegative().nullable(),
  tier: z.union([
    z.literal(100),
    z.literal(200),
    z.literal(300),
    z.literal(400),
    z.literal(800),
  ]),
  footprint: z.object({
    width: z.number().positive(),
    height: z.number().positive(),
  }),
  range: z.number().nonnegative().nullable(),
  speed: z.number().nonnegative().nullable(),
  isAir: z.boolean(),
  canTargetAir: z.boolean(),
  canTargetGround: z.boolean(),
  roles: z.array(z.string()),
  techs: z.record(z.string(), techSchema),
});

const entries = z.record(z.string(), catalogEntrySchema);

export const patchDataSchema = z.object({
  version: z.string().min(1),
  sources: z.array(z.url()),
  notes: z.array(z.string()),
  units: z.record(z.string(), patchUnitSchema),
  spells: entries,
  specialists: entries,
  items: entries,
  devices: entries,
  towers: entries,
  blueprints: entries,
});

export type PatchData = z.infer<typeof patchDataSchema>;
export type PatchUnit = z.infer<typeof patchUnitSchema>;
export type PatchTech = z.infer<typeof techSchema>;
