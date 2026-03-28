import { z } from "zod";

import { ConfidenceLevelSchema, DetectedItemSchema, NutritionRangeSchema } from "./shared";

export const MealInferenceModelOutputSchema = z
  .object({
    confidence: ConfidenceLevelSchema,
    detectedItems: z.array(DetectedItemSchema),
    nutritionEstimate: z
      .object({
        calories: NutritionRangeSchema.nullable(),
        protein_g: NutritionRangeSchema.nullable(),
        carbs_g: NutritionRangeSchema.nullable(),
        fat_g: NutritionRangeSchema.nullable(),
      })
      .strict()
      .nullable(),
    uncertaintyNotes: z.array(z.string().trim().min(1)),
    clarifyingQuestion: z.string().trim().min(1).nullable(),
    abstainRecommended: z.boolean(),
    modelFlags: z.array(z.string().trim().min(1)).default([]),
  })
  .strict();

export const mealInferenceModelJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "confidence",
    "detectedItems",
    "nutritionEstimate",
    "uncertaintyNotes",
    "clarifyingQuestion",
    "abstainRecommended",
    "modelFlags",
  ],
  properties: {
    confidence: {
      type: "string",
      enum: ["low", "medium", "high"],
    },
    detectedItems: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["name", "evidence", "confidence"],
        properties: {
          name: { type: "string" },
          evidence: { type: "string", enum: ["visible", "inferred"] },
          confidence: { type: "string", enum: ["low", "medium", "high"] },
        },
      },
    },
    nutritionEstimate: {
      anyOf: [
        { type: "null" },
        {
          type: "object",
          additionalProperties: false,
          required: ["calories", "protein_g", "carbs_g", "fat_g"],
          properties: {
            calories: {
              anyOf: [
                { type: "null" },
                {
                  type: "object",
                  additionalProperties: false,
                  required: ["lower", "upper"],
                  properties: {
                    lower: { type: "number" },
                    upper: { type: "number" },
                  },
                },
              ],
            },
            protein_g: {
              anyOf: [
                { type: "null" },
                {
                  type: "object",
                  additionalProperties: false,
                  required: ["lower", "upper"],
                  properties: {
                    lower: { type: "number" },
                    upper: { type: "number" },
                  },
                },
              ],
            },
            carbs_g: {
              anyOf: [
                { type: "null" },
                {
                  type: "object",
                  additionalProperties: false,
                  required: ["lower", "upper"],
                  properties: {
                    lower: { type: "number" },
                    upper: { type: "number" },
                  },
                },
              ],
            },
            fat_g: {
              anyOf: [
                { type: "null" },
                {
                  type: "object",
                  additionalProperties: false,
                  required: ["lower", "upper"],
                  properties: {
                    lower: { type: "number" },
                    upper: { type: "number" },
                  },
                },
              ],
            },
          },
        },
      ],
    },
    uncertaintyNotes: {
      type: "array",
      items: { type: "string" },
    },
    clarifyingQuestion: {
      type: ["string", "null"],
    },
    abstainRecommended: {
      type: "boolean",
    },
    modelFlags: {
      type: "array",
      items: { type: "string" },
    },
  },
} as const;

export type MealInferenceModelOutput = z.infer<typeof MealInferenceModelOutputSchema>;
