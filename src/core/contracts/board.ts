import { z } from "zod";

export const boardRectangleSchema = z.object({
  x: z.number(),
  y: z.number(),
  width: z.number().positive(),
  height: z.number().positive(),
});

export const boardHighlightSchema = z.object({
  region: boardRectangleSchema.optional(),
  units: z.array(
    z.object({
      playerId: z.string().min(1),
      instanceId: z.string().min(1),
    }),
  ),
});

export type BoardRectangle = z.infer<typeof boardRectangleSchema>;
export type BoardHighlight = z.infer<typeof boardHighlightSchema>;
