import type { NextFunction, Request, Response } from "express";

import type { MealAnalysisOrchestrator } from "../pipeline/orchestrator/mealAnalysisOrchestrator";
import { logger } from "../services/logging/logger";
import { demoObservability } from "../services/observability/demoObservability";

export class MealAnalysisController {
  constructor(private readonly orchestrator: MealAnalysisOrchestrator) {}

  analyzeMeal = async (
    request: Request,
    response: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const payload = await this.orchestrator.analyze(
        request.body,
        request.requestId,
      );

      logger.requestCompleted({
        request_id: payload.requestId,
        http_status: 200,
        result_status: payload.status,
        total_latency_ms: Date.now() - (request.requestStartedAt ?? Date.now()),
        abstained: payload.abstained,
        policy_flag_count: payload.policyFlags.length,
      });
      demoObservability.recordRequestOutcome({
        requestId: payload.requestId,
        outcome: payload.status === "ok" ? "accepted" : "abstained",
        reasonCode: payload.reason,
        confidenceLevel: payload.confidence,
        latencyMs: Date.now() - (request.requestStartedAt ?? Date.now()),
      });

      response.status(200).json(payload);
    } catch (error) {
      next(error);
    }
  };
}
