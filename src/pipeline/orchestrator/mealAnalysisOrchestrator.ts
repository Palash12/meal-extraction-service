import { randomUUID } from "crypto";

import type { ImageFetchClient } from "../../clients/imageFetchClient";
import type { OpenAIClient } from "../../clients/openaiClient";
import { AppError } from "../../lib/errors";
import { MealAnalysisResponseSchema } from "../../schemas/mealAnalysisResponse";
import { buildFinalResponse } from "../outputGuardrails/buildFinalResponse";
import { enforceSafetyPolicy } from "../outputGuardrails/enforceSafetyPolicy";
import type { FeatureFlags } from "../../services/config/featureFlags";
import { demoObservability } from "../../services/observability/demoObservability";
import { createStageTimer } from "../../services/observability/stageTimer";
import { createTraceContext } from "../../services/observability/modelTrace";
import { noOpMetrics } from "../../services/observability/metrics";
import { logger } from "../../services/logging/logger";
import { noOpTracer } from "../../services/observability/tracer";
import { assessImageUsability } from "../inputGuardrails/assessImageUsability";
import { fetchImageMetadata } from "../inputGuardrails/fetchImageMetadata";
import { validateRequestInput } from "../inputGuardrails/validateRequest";
import { runMealInference } from "../mealInference/mealInferenceStage";
import { runNutritionGroundingStage } from "../nutritionGrounding/nutritionGroundingStage";
import { moderateUnsafeImage } from "../unsafeScreening/moderateUnsafeImage";
import type {
  MealAnalysisRequest,
  MealAnalysisResponse,
} from "../../types/api";

export interface MealAnalysisOrchestratorDependencies {
  imageFetchClient: ImageFetchClient;
  openAIClient: OpenAIClient;
  featureFlags: FeatureFlags;
}

export interface MealAnalysisDemoOverrides {
  forceUnsafeRejection?: boolean;
  forceInferenceFailure?: boolean;
}

export class MealAnalysisOrchestrator {
  constructor(
    private readonly dependencies: MealAnalysisOrchestratorDependencies,
  ) {}

  async analyze(
    rawRequest: unknown,
    requestId?: string,
    demoOverrides: MealAnalysisDemoOverrides = {},
  ): Promise<MealAnalysisResponse> {
    const resolvedRequestId = this.resolveRequestId(rawRequest, requestId);
    const timer = createStageTimer();
    const trace = createTraceContext({
      requestId: resolvedRequestId,
      inferenceModel: this.dependencies.openAIClient.getInferenceModel(),
      moderationModel: this.dependencies.openAIClient.getModerationModel(),
      promptVersion: "mealNutritionEstimate.v1",
    });

    noOpTracer.startSpan("http.request", {
      request_id: trace.requestId,
    });
    demoObservability.recordRequestStarted(trace.requestId);

    const request = validateRequestInput(
      this.attachRequestId(rawRequest, resolvedRequestId),
    );

    timer.start("input_guardrails");
    noOpTracer.startSpan("input_guardrails", {
      request_id: trace.requestId,
      stage: "input_guardrails",
    });
    const fetchedImage = await fetchImageMetadata(
      this.dependencies.imageFetchClient,
      request.image_url,
      trace.requestId,
    );
    const inputGuardrails = assessImageUsability(fetchedImage);
    const inputGuardrailsLatencyMs = timer.end("input_guardrails");

    if (!inputGuardrails.accepted) {
      demoObservability.recordStageDecision({
        requestId: trace.requestId,
        stage: "input_guardrails",
        outcome: "rejected",
        reasonCode: inputGuardrails.rejectionCode,
        latencyMs: inputGuardrailsLatencyMs,
        details: {
          policy_flag_count: inputGuardrails.policyFlags.length,
        },
      });
      throw new AppError(
        400,
        "INPUT_REJECTED",
        inputGuardrails.rejectionReason ?? "Input rejected",
        {
          reasonCode: inputGuardrails.rejectionCode ?? "INPUT_REJECTED",
          stage: "input_guardrails",
          contentType: fetchedImage.contentType,
          contentLength: fetchedImage.contentLength,
        },
      );
    }
    demoObservability.recordStageDecision({
      requestId: trace.requestId,
      stage: "input_guardrails",
      outcome: "accepted",
      latencyMs: inputGuardrailsLatencyMs,
      details: {
        policy_flag_count: inputGuardrails.policyFlags.length,
      },
    });

    timer.start("unsafe_screening");
    if (demoOverrides.forceUnsafeRejection && this.dependencies.featureFlags.demoMode) {
      const unsafeScreeningLatencyMs = timer.end("unsafe_screening");
      logger.unsafeContentRejected({
        request_id: trace.requestId,
        reason_code: "UNSAFE_IMAGE",
        policy_flags: ["UNSAFE_IMAGE"],
        model_name: trace.moderationModel ?? "demo-moderation",
        latency_ms: unsafeScreeningLatencyMs,
      });
      demoObservability.recordStageDecision({
        requestId: trace.requestId,
        stage: "unsafe_screening",
        outcome: "blocked",
        reasonCode: "UNSAFE_IMAGE",
        latencyMs: unsafeScreeningLatencyMs,
        details: {
          local_demo_only: true,
          forced_rejection: true,
          policy_flag_count: 1,
        },
      });
      throw new AppError(400, "INPUT_REJECTED", "Image contains unsafe or disallowed content", {
        reasonCode: "UNSAFE_IMAGE",
        stage: "unsafe_screening",
        policyFlags: ["UNSAFE_IMAGE"],
      });
    }

    if (this.dependencies.featureFlags.enableUnsafeScreening) {
      const unsafeScreening = await moderateUnsafeImage(
        this.dependencies.openAIClient,
        fetchedImage,
        trace.requestId,
      );

      if (!unsafeScreening.allowed) {
        const unsafeScreeningLatencyMs = timer.end("unsafe_screening");
        demoObservability.recordStageDecision({
          requestId: trace.requestId,
          stage: "unsafe_screening",
          outcome: "blocked",
          reasonCode: unsafeScreening.reasonCode,
          latencyMs: unsafeScreeningLatencyMs,
          details: {
            policy_flag_count: unsafeScreening.policyFlags.length,
          },
        });
        throw new AppError(
          400,
          "INPUT_REJECTED",
          "Image contains unsafe or disallowed content",
          {
            reasonCode: unsafeScreening.reasonCode ?? "UNSAFE_IMAGE",
            stage: "unsafe_screening",
            policyFlags: unsafeScreening.policyFlags,
          },
        );
      }

      demoObservability.recordStageDecision({
        requestId: trace.requestId,
        stage: "unsafe_screening",
        outcome: "allowed",
        latencyMs: timer.end("unsafe_screening"),
      });
    } else {
      demoObservability.recordStageDecision({
        requestId: trace.requestId,
        stage: "unsafe_screening",
        outcome: "skipped",
        reasonCode: "DEMO_FLAG_DISABLED",
        details: {
          local_demo_only: true,
        },
      });
      timer.end("unsafe_screening");
    }

    timer.start("meal_inference");
    if (demoOverrides.forceInferenceFailure && this.dependencies.featureFlags.demoMode) {
      const inferenceLatencyMs = timer.end("meal_inference");
      demoObservability.recordStageDecision({
        requestId: trace.requestId,
        stage: "meal_inference",
        outcome: "error",
        reasonCode: "UPSTREAM_INFERENCE_FAILURE",
        latencyMs: inferenceLatencyMs,
        details: {
          local_demo_only: true,
          forced_failure: true,
        },
      });
      throw new AppError(
        502,
        "UPSTREAM_INFERENCE_FAILURE",
        "Meal inference failed",
      );
    }

    const inference = await runMealInference(
      this.dependencies.openAIClient,
      request,
    );
    const mealInferenceLatencyMs = timer.end("meal_inference");
    demoObservability.recordStageDecision({
      requestId: trace.requestId,
      stage: "meal_inference",
      outcome: "completed",
      confidenceLevel: inference.confidence,
      modelName: trace.inferenceModel,
      promptVersion: trace.promptVersion,
      latencyMs: mealInferenceLatencyMs,
      details: {
        model_flag_count: inference.modelFlags.length,
        detected_item_count: inference.detectedItems.length,
      },
    });

    timer.start("nutrition_grounding");
    const groundedInference = await runNutritionGroundingStage(
      inference,
      this.dependencies.openAIClient,
    );
    const nutritionGroundingLatencyMs = timer.end("nutrition_grounding");
    demoObservability.recordStageDecision({
      requestId: trace.requestId,
      stage: "nutrition_grounding",
      outcome: "completed",
      confidenceLevel: groundedInference.confidence,
      latencyMs: nutritionGroundingLatencyMs,
      details: {
        matched_item_count: groundedInference.groundingMatches.filter(
          (match) => match.canonicalName !== null,
        ).length,
        unmatched_item_count: groundedInference.groundingMatches.filter(
          (match) => match.canonicalName === null,
        ).length,
      },
    });

    timer.start("output_guardrails");
    const output = this.dependencies.featureFlags.enableOutputGuardrails
      ? enforceSafetyPolicy(groundedInference, trace.requestId, {
          demoObservability,
          forceAbstainOnLowConfidence:
            this.dependencies.featureFlags.forceAbstainOnLowConfidence,
        })
      : {
          status: "ok" as const,
          policyFlags: groundedInference.modelFlags,
          abstained: false,
          reason: null,
          clarifyingQuestion: groundedInference.clarifyingQuestion,
          changedOutcome: false,
        };
    const outputGuardrailsLatencyMs = timer.end("output_guardrails");

    if (!this.dependencies.featureFlags.enableOutputGuardrails) {
      demoObservability.recordStageDecision({
        requestId: trace.requestId,
        stage: "output_guardrails",
        outcome: "skipped",
        confidenceLevel: groundedInference.confidence,
        reasonCode: "DEMO_FLAG_DISABLED",
        latencyMs: outputGuardrailsLatencyMs,
        details: {
          local_demo_only: true,
        },
      });
    }

    if (output.status === "ok") {
      noOpMetrics.increment("successful_analyses_total");
    }

    return MealAnalysisResponseSchema.parse(
      buildFinalResponse(request, groundedInference, output),
    );
  }

  private attachRequestId(
    rawRequest: unknown,
    requestId: string,
  ): MealAnalysisRequest {
    if (
      rawRequest &&
      typeof rawRequest === "object" &&
      !Array.isArray(rawRequest)
    ) {
      return {
        ...(rawRequest as Record<string, unknown>),
        request_id: requestId,
      } as MealAnalysisRequest;
    }

    return {
      image_url: "",
      request_id: requestId,
    };
  }

  private resolveRequestId(rawRequest: unknown, requestId?: string): string {
    if (requestId) {
      return requestId;
    }

    if (
      rawRequest &&
      typeof rawRequest === "object" &&
      "request_id" in rawRequest &&
      typeof (rawRequest as { request_id?: unknown }).request_id === "string" &&
      (rawRequest as { request_id: string }).request_id.trim().length > 0
    ) {
      return (rawRequest as { request_id: string }).request_id;
    }

    return randomUUID();
  }
}
