import type { NextFunction, Request, Response } from "express";

import { logger } from "../lib/logger";
import { MealExtractionRequestSchema } from "../schemas/mealRequest";
import type { MealExtractionService } from "../services/mealExtractionService";

export class MealExtractionController {
  constructor(private readonly mealExtractionService: MealExtractionService) {}

  extractMeal = async (
    request: Request,
    response: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const parsedRequest = MealExtractionRequestSchema.parse(request.body);
      const result =
        await this.mealExtractionService.extractMeal(parsedRequest);

      logger.info("meal_extraction_completed", {
        request_id: request.requestId ?? parsedRequest.request_id,
        needs_user_confirmation: result.needs_user_confirmation,
      });

      response.status(200).json(result);
    } catch (error) {
      next(error);
    }
  };
}
