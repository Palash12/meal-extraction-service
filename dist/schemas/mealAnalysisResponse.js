"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MealAnalysisResponseSchema = exports.NutritionEstimateSchema = void 0;
const zod_1 = require("zod");
const shared_1 = require("./shared");
const PolicyFlagSchema = zod_1.z.enum([
    "UNSAFE_IMAGE",
    "LOW_CONFIDENCE",
    "MEDICAL_ADVICE_BLOCKED",
    "NON_FOOD_IMAGE",
    "UNUSABLE_IMAGE",
    "FORCED_ABSTENTION",
]);
exports.NutritionEstimateSchema = zod_1.z
    .object({
    calories: shared_1.NutritionRangeSchema.nullable(),
    protein_g: shared_1.NutritionRangeSchema.nullable(),
    carbs_g: shared_1.NutritionRangeSchema.nullable(),
    fat_g: shared_1.NutritionRangeSchema.nullable(),
})
    .strict();
exports.MealAnalysisResponseSchema = zod_1.z
    .object({
    requestId: zod_1.z.string().trim().min(1),
    status: zod_1.z.enum(["ok", "abstained", "rejected_input", "error"]),
    confidence: shared_1.ConfidenceLevelSchema.nullable(),
    detectedItems: zod_1.z.array(shared_1.DetectedItemSchema),
    nutritionEstimate: exports.NutritionEstimateSchema.nullable(),
    uncertaintyNotes: zod_1.z.array(zod_1.z.string().trim().min(1)),
    clarifyingQuestion: zod_1.z.string().trim().min(1).nullable(),
    policyFlags: zod_1.z.array(PolicyFlagSchema),
    abstained: zod_1.z.boolean(),
    reason: zod_1.z.string().trim().min(1).nullable(),
})
    .strict();
