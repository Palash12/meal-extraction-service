import type {
  MealAnalysisRequest,
  MealAnalysisResponse,
} from "../../types/api";
import type {
  MealInferenceResult,
  OutputGuardrailsResult,
} from "../../types/pipeline";

export function buildFinalResponse(
  request: MealAnalysisRequest,
  inference: MealInferenceResult,
  output: OutputGuardrailsResult,
): MealAnalysisResponse {
  const clarifyingQuestion =
    output.abstained && output.reason === "MEDICAL_ADVICE_BLOCKED"
      ? null
      : output.clarifyingQuestion;

  return {
    requestId: request.request_id ?? "unknown",
    status: output.status,
    confidence: inference.confidence,
    detectedItems: inference.detectedItems,
    nutritionEstimate: inference.nutritionEstimate,
    uncertaintyNotes: inference.uncertaintyNotes,
    clarifyingQuestion,
    policyFlags: output.policyFlags,
    abstained: output.abstained,
    reason: output.reason,
  };
}
