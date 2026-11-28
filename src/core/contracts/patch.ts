import { z } from "zod";

export const maxUnitLevel = 9;

const catalogEntrySchema = z.object({
  name: z.string().min(1),
  cost: z.number().nonnegative().nullable(),
});

const combatModifier = z
  .object({
    hpRate: z.number().nonnegative().optional(),
    damageRate: z.number().nonnegative().optional(),
  })
  .optional();

const techSchema = catalogEntrySchema.extend({
  combatModifier,
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
  combat: z
    .object({
      hp: z.number().int().positive(),
      source: z.url(),
      levelRule: z.literal("linear-1-to-9"),
      attack: z
        .object({
          damage: z.number().int().positive(),
          intervalSeconds: z.number().positive(),
        })
        .optional(),
    })
    .optional(),
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
  items: z.record(z.string(), catalogEntrySchema.extend({ combatModifier })),
  devices: entries,
  towers: entries,
  blueprints: entries,
});

export type PatchData = z.infer<typeof patchDataSchema>;
export type PatchUnit = z.infer<typeof patchUnitSchema>;
export type PatchTech = z.infer<typeof techSchema>;
