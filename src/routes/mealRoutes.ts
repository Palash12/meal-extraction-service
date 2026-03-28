import { Router } from "express";

import type { MealExtractionController } from "../controllers/mealExtractionController";

export function createMealRoutes(controller: MealExtractionController): Router {
  const router = Router();

  router.post("/v1/meals/extract", controller.extractMeal);

  return router;
}
