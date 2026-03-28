"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizeMealInference = normalizeMealInference;
const mealInferenceModel_1 = require("../../schemas/mealInferenceModel");
const SUPPORTED_MODEL_FLAGS = new Set(["LOW_CONFIDENCE"]);
function normalizeModelFlags(flags) {
    return flags.filter((flag) => SUPPORTED_MODEL_FLAGS.has(flag));
}
function normalizeMealInference(result) {
    const parsed = mealInferenceModel_1.MealInferenceModelOutputSchema.parse(result);
    return {
        confidence: parsed.confidence,
        detectedItems: parsed.detectedItems,
        nutritionEstimate: parsed.nutritionEstimate,
        uncertaintyNotes: parsed.uncertaintyNotes,
        clarifyingQuestion: parsed.clarifyingQuestion,
        abstainRecommended: parsed.abstainRecommended || parsed.confidence === "low",
        modelFlags: normalizeModelFlags(parsed.modelFlags),
    };
}
