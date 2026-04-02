import type { NextFunction, Request, Response } from "express";

import type { MealAnalysisOrchestrator } from "../pipeline/orchestrator/mealAnalysisOrchestrator";
import { logger } from "../services/logging/logger";
import { demoObservability } from "../services/observability/demoObservability";

function parseDemoHeader(value: string | string[] | undefined): boolean {
  if (Array.isArray(value)) {
    return value.some((item) => parseDemoHeader(item));
  }

  if (typeof value !== "string") {
    return false;
  }

  return ["1", "true", "yes", "on"].includes(value.trim().toLowerCase());
}

export class MealAnalysisController {
  constructor(private readonly orchestrator: MealAnalysisOrchestrator) {}

  analyzeMeal = async (
    request: Request,
    response: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const demoOverrides = {
        forceUnsafeRejection: parseDemoHeader(
          request.header("x-demo-force-unsafe-rejection"),
        ),
        forceInferenceFailure: parseDemoHeader(
          request.header("x-demo-force-inference-failure"),
        ),
      };

      const payload = await this.orchestrator.analyze(
        request.body,
        request.requestId,
        demoOverrides,
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
