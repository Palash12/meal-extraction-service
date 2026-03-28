import { z } from "zod";

import {
  ConfidenceLevelSchema,
  DetectedItemSchema,
  NutritionRangeSchema,
} from "./shared";

const PolicyFlagSchema = z.enum([
  "UNSAFE_IMAGE",
  "LOW_CONFIDENCE",
  "MEDICAL_ADVICE_BLOCKED",
  "NON_FOOD_IMAGE",
  "UNUSABLE_IMAGE",
  "FORCED_ABSTENTION",
]);

export const NutritionEstimateSchema = z
  .object({
    calories: NutritionRangeSchema.nullable(),
    protein_g: NutritionRangeSchema.nullable(),
    carbs_g: NutritionRangeSchema.nullable(),
    fat_g: NutritionRangeSchema.nullable(),
  })
  .strict();

export const MealAnalysisResponseSchema = z
  .object({
    requestId: z.string().trim().min(1),
    status: z.enum(["ok", "abstained", "rejected_input", "error"]),
    confidence: ConfidenceLevelSchema.nullable(),
    detectedItems: z.array(DetectedItemSchema),
    nutritionEstimate: NutritionEstimateSchema.nullable(),
    uncertaintyNotes: z.array(z.string().trim().min(1)),
    clarifyingQuestion: z.string().trim().min(1).nullable(),
    policyFlags: z.array(PolicyFlagSchema),
    abstained: z.boolean(),
    reason: z.string().trim().min(1).nullable(),
  })
  .strict();

export type MealAnalysisResponseOutput = z.infer<typeof MealAnalysisResponseSchema>;
