"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.mealInferenceModelJsonSchema = exports.MealInferenceModelOutputSchema = void 0;
const zod_1 = require("zod");
const shared_1 = require("./shared");
exports.MealInferenceModelOutputSchema = zod_1.z
    .object({
    confidence: shared_1.ConfidenceLevelSchema,
    detectedItems: zod_1.z.array(shared_1.DetectedItemSchema),
    nutritionEstimate: zod_1.z
        .object({
        calories: shared_1.NutritionRangeSchema.nullable(),
        protein_g: shared_1.NutritionRangeSchema.nullable(),
        carbs_g: shared_1.NutritionRangeSchema.nullable(),
        fat_g: shared_1.NutritionRangeSchema.nullable(),
    })
        .strict()
        .nullable(),
    uncertaintyNotes: zod_1.z.array(zod_1.z.string().trim().min(1)),
    clarifyingQuestion: zod_1.z.string().trim().min(1).nullable(),
    abstainRecommended: zod_1.z.boolean(),
    modelFlags: zod_1.z.array(zod_1.z.string().trim().min(1)).default([]),
})
    .strict();
exports.mealInferenceModelJsonSchema = {
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
};
