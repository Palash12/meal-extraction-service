import { z } from "zod";

export const PortionEstimateSchema = z
  .object({
    size: z.enum([
      "very_small",
      "small",
      "medium",
      "large",
      "very_large",
      "unknown",
    ]),
    confidence: z.enum(["low", "medium", "high"]),
    notes: z.string().trim().min(1).max(500),
  })
  .strict();

export const MealExtractionResultSchema = z
  .object({
    dish_candidates: z.array(z.string().trim().min(1)).max(10),
    visible_components: z.array(z.string().trim().min(1)).max(25),
    portion_estimate: PortionEstimateSchema,
    observed: z.array(z.string().trim().min(1)).max(25),
    assumed: z.array(z.string().trim().min(1)).max(25),
    unknown: z.array(z.string().trim().min(1)).max(25),
    needs_user_confirmation: z.boolean(),
    clarifying_question: z.string().trim().max(300).nullable(),
  })
  .strict();

export const mealExtractionJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "dish_candidates",
    "visible_components",
    "portion_estimate",
    "observed",
    "assumed",
    "unknown",
    "needs_user_confirmation",
    "clarifying_question",
  ],
  properties: {
    dish_candidates: {
      type: "array",
      items: { type: "string" },
      maxItems: 10,
    },
    visible_components: {
      type: "array",
      items: { type: "string" },
      maxItems: 25,
    },
    portion_estimate: {
      type: "object",
      additionalProperties: false,
      required: ["size", "confidence", "notes"],
      properties: {
        size: {
          type: "string",
          enum: [
            "very_small",
            "small",
            "medium",
            "large",
            "very_large",
            "unknown",
          ],
        },
        confidence: {
          type: "string",
          enum: ["low", "medium", "high"],
        },
        notes: {
          type: "string",
          maxLength: 500,
        },
      },
    },
    observed: {
      type: "array",
      items: { type: "string" },
      maxItems: 25,
    },
    assumed: {
      type: "array",
      items: { type: "string" },
      maxItems: 25,
    },
    unknown: {
      type: "array",
      items: { type: "string" },
      maxItems: 25,
    },
    needs_user_confirmation: {
      type: "boolean",
    },
    clarifying_question: {
      type: ["string", "null"],
      maxLength: 300,
    },
  },
} as const;

export type MealExtractionOutput = z.infer<typeof MealExtractionResultSchema>;
