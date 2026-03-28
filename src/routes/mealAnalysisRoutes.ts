import { Router } from "express";

import type { MealAnalysisController } from "../controllers/mealAnalysisController";

export function createMealAnalysisRoutes(controller: MealAnalysisController): Router {
  const router = Router();

  router.post("/v1/meals/analyze", controller.analyzeMeal);

  return router;
}
