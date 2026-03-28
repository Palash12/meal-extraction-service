import type { OpenAIClient } from "../../clients/openaiClient";
import type { MealAnalysisRequest } from "../../types/api";
import type { MealInferenceResult } from "../../types/pipeline";

export async function runMealInference(
  openAIClient: OpenAIClient,
  request: MealAnalysisRequest,
): Promise<MealInferenceResult> {
  return openAIClient.inferMeal(request);
}
