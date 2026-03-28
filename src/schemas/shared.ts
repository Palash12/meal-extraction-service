import { z } from "zod";

export const ConfidenceLevelSchema = z.enum(["low", "medium", "high"]);

export const NutritionRangeSchema = z
  .object({
    lower: z.number().nonnegative(),
    upper: z.number().nonnegative(),
  })
  .strict();

export const DetectedItemSchema = z
  .object({
    name: z.string().trim().min(1),
    evidence: z.enum(["visible", "inferred"]),
    confidence: ConfidenceLevelSchema,
  })
  .strict();
