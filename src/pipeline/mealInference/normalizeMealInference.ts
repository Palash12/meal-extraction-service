import { MealInferenceModelOutputSchema, type MealInferenceModelOutput } from "../../schemas/mealInferenceModel";
import type { PolicyFlag } from "../../types/api";
import type { MealInferenceResult } from "../../types/pipeline";

const SUPPORTED_MODEL_FLAGS = new Set<PolicyFlag>(["LOW_CONFIDENCE"]);

function normalizeModelFlags(flags: string[]): PolicyFlag[] {
  return flags.filter((flag): flag is PolicyFlag => SUPPORTED_MODEL_FLAGS.has(flag as PolicyFlag));
}

export function normalizeMealInference(result: unknown): MealInferenceResult {
  const parsed: MealInferenceModelOutput = MealInferenceModelOutputSchema.parse(result);

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
