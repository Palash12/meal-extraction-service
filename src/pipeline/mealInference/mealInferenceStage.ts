import type { OpenAIClient } from "../../clients/openaiClient";
import type { MealAnalysisRequest } from "../../types/api";
import type { MealExtractionResult } from "../../types/pipeline";

export async function runMealInference(
  openAIClient: OpenAIClient,
  request: MealAnalysisRequest,
): Promise<MealExtractionResult> {
  return openAIClient.inferMeal(request);
}
