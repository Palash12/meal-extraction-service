import { MealAnalysisRequestSchema } from "../../schemas/mealAnalysisRequest";
import type { MealAnalysisRequest } from "../../types/api";

export function validateRequestInput(
  request: MealAnalysisRequest,
): MealAnalysisRequest {
  return MealAnalysisRequestSchema.parse(request);
}
