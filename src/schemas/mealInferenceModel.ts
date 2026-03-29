import { z } from "zod";

import { ConfidenceLevelSchema } from "./shared";

const MealExtractionItemSchema = z
  .object({
    name: z.string().trim().min(1),
    evidence: z.enum(["visible", "inferred"]),
    confidence: ConfidenceLevelSchema,
    portionEstimate: z.number().positive(),
    portionUnit: z.string().trim().min(1),
    reasoningNote: z.string().trim().min(1),
  })
  .strict();

export const MealInferenceModelOutputSchema = z
  .object({
    mealDetected: z.boolean(),
    unsafeOrDisallowedDetected: z.boolean(),
    imageUsable: z.boolean(),
    confidence: ConfidenceLevelSchema,
    detectedItems: z.array(MealExtractionItemSchema),
    uncertaintyNotes: z.array(z.string().trim().min(1)),
    clarifyingQuestion: z.string().trim().min(1).nullable(),
    abstainRecommended: z.boolean(),
  })
  .strict();

export const mealInferenceModelJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "mealDetected",
    "unsafeOrDisallowedDetected",
    "imageUsable",
    "confidence",
    "detectedItems",
    "uncertaintyNotes",
    "clarifyingQuestion",
    "abstainRecommended",
  ],
  properties: {
    mealDetected: {
      type: "boolean",
    },
    unsafeOrDisallowedDetected: {
      type: "boolean",
    },
    imageUsable: {
      type: "boolean",
    },
    confidence: {
      type: "string",
      enum: ["low", "medium", "high"],
    },
    detectedItems: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: [
          "name",
          "evidence",
          "confidence",
          "portionEstimate",
          "portionUnit",
          "reasoningNote",
        ],
        properties: {
          name: { type: "string" },
          evidence: { type: "string", enum: ["visible", "inferred"] },
          confidence: { type: "string", enum: ["low", "medium", "high"] },
          portionEstimate: { type: "number", exclusiveMinimum: 0 },
          portionUnit: { type: "string" },
          reasoningNote: { type: "string" },
        },
      },
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
  },
} as const;

export type MealInferenceModelOutput = z.infer<
  typeof MealInferenceModelOutputSchema
>;
