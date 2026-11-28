import { z } from "zod";
import { standardBoard } from "../geometry";
import { maxUnitLevel } from "./patch";

const bounds = standardBoard.bounds;
export const scenarioUnitLimit = 96;
export const scenarioPrefix = "#board=";
const identifier = z.string().regex(/^[a-zA-Z0-9_-]{1,24}$/);
const patchId = z.string().regex(/^[a-zA-Z0-9._-]{1,48}$/);

export const scenarioUnitSchema = z.object({
  id: identifier,
  side: z.enum(["south", "north"]),
  unitId: identifier,
  x: z
    .number()
    .min(bounds.x)
    .max(bounds.x + bounds.width),
  y: z
    .number()
    .min(bounds.y)
    .max(bounds.y + bounds.height),
  orientation: z.number().int().min(0).max(359).optional(),
  level: z.number().int().min(1).max(maxUnitLevel),
  techIds: z
    .array(identifier)
    .max(24)
    .refine(
      (ids) => new Set(ids).size === ids.length,
      "Scenario tech IDs must be unique.",
    ),
  itemId: identifier.optional(),
});

export const scenarioSchema = z.object({
  version: z.literal(1),
  patchVersion: patchId,
  units: z
    .array(scenarioUnitSchema)
    .max(scenarioUnitLimit)
    .refine(
      (units) => new Set(units.map(({ id }) => id)).size === units.length,
      "Scenario unit IDs must be unique.",
    ),
});

export type Scenario = z.infer<typeof scenarioSchema>;
export type ScenarioUnit = z.infer<typeof scenarioUnitSchema>;
