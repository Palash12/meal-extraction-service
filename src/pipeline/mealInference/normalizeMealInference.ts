import {
  MealInferenceModelOutputSchema,
  type MealInferenceModelOutput,
} from "../../schemas/mealInferenceModel";
import type { PolicyFlag } from "../../types/api";
import type { MealExtractionResult } from "../../types/pipeline";

const SUPPORTED_MODEL_FLAGS = new Set<PolicyFlag>(["LOW_CONFIDENCE"]);

function normalizeModelFlags(flags: string[]): PolicyFlag[] {
  return flags.filter((flag): flag is PolicyFlag =>
    SUPPORTED_MODEL_FLAGS.has(flag as PolicyFlag),
  );
}

export function normalizeMealInference(result: unknown): MealExtractionResult {
  const parsed: MealInferenceModelOutput =
    MealInferenceModelOutputSchema.parse(result);

  return {
    mealDetected: parsed.mealDetected,
    unsafeOrDisallowedDetected: parsed.unsafeOrDisallowedDetected,
    imageUsable: parsed.imageUsable,
    confidence: parsed.confidence,
    detectedItems: parsed.detectedItems,
    uncertaintyNotes: parsed.uncertaintyNotes,
    clarifyingQuestion: parsed.clarifyingQuestion,
    abstainRecommended: parsed.abstainRecommended || parsed.confidence === "low",
    modelFlags: normalizeModelFlags(
      parsed.confidence === "low" ? ["LOW_CONFIDENCE"] : [],
    ),
  };
}
