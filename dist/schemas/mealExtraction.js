"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.mealExtractionJsonSchema = exports.MealExtractionResultSchema = exports.PortionEstimateSchema = void 0;
const zod_1 = require("zod");
exports.PortionEstimateSchema = zod_1.z
    .object({
    size: zod_1.z.enum(["very_small", "small", "medium", "large", "very_large", "unknown"]),
    confidence: zod_1.z.enum(["low", "medium", "high"]),
    notes: zod_1.z.string().trim().min(1).max(500),
})
    .strict();
exports.MealExtractionResultSchema = zod_1.z
    .object({
    dish_candidates: zod_1.z.array(zod_1.z.string().trim().min(1)).max(10),
    visible_components: zod_1.z.array(zod_1.z.string().trim().min(1)).max(25),
    portion_estimate: exports.PortionEstimateSchema,
    observed: zod_1.z.array(zod_1.z.string().trim().min(1)).max(25),
    assumed: zod_1.z.array(zod_1.z.string().trim().min(1)).max(25),
    unknown: zod_1.z.array(zod_1.z.string().trim().min(1)).max(25),
    needs_user_confirmation: zod_1.z.boolean(),
    clarifying_question: zod_1.z.string().trim().max(300).nullable(),
})
    .strict();
exports.mealExtractionJsonSchema = {
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
                    enum: ["very_small", "small", "medium", "large", "very_large", "unknown"],
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
};
