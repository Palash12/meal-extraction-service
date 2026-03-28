import { randomUUID } from "crypto";

import type { ImageFetchClient } from "../../clients/imageFetchClient";
import type { OpenAIClient } from "../../clients/openaiClient";
import { AppError } from "../../lib/errors";
import { MealAnalysisResponseSchema } from "../../schemas/mealAnalysisResponse";
import { buildFinalResponse } from "../outputGuardrails/buildFinalResponse";
import { enforceSafetyPolicy } from "../outputGuardrails/enforceSafetyPolicy";
import type { FeatureFlags } from "../../services/config/featureFlags";
import { createStageTimer } from "../../services/observability/stageTimer";
import { createTraceContext } from "../../services/observability/modelTrace";
import { noOpMetrics } from "../../services/observability/metrics";
import { noOpTracer } from "../../services/observability/tracer";
import { assessImageUsability } from "../inputGuardrails/assessImageUsability";
import { fetchImageMetadata } from "../inputGuardrails/fetchImageMetadata";
import { validateRequestInput } from "../inputGuardrails/validateRequest";
import { runMealInference } from "../mealInference/mealInferenceStage";
import { moderateUnsafeImage } from "../unsafeScreening/moderateUnsafeImage";
import type { MealAnalysisRequest, MealAnalysisResponse, PolicyFlag } from "../../types/api";

export interface MealAnalysisOrchestratorDependencies {
  imageFetchClient: ImageFetchClient;
  openAIClient: OpenAIClient;
  featureFlags: FeatureFlags;
}

export class MealAnalysisOrchestrator {
  constructor(private readonly dependencies: MealAnalysisOrchestratorDependencies) {}

  async analyze(rawRequest: unknown, requestId?: string): Promise<MealAnalysisResponse> {
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

    const request = validateRequestInput(this.attachRequestId(rawRequest, resolvedRequestId));

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
    timer.end("input_guardrails");

    if (!inputGuardrails.accepted) {
      throw new AppError(400, "INPUT_REJECTED", inputGuardrails.rejectionReason ?? "Input rejected", {
        reasonCode: inputGuardrails.rejectionCode ?? "INPUT_REJECTED",
        stage: "input_guardrails",
        contentType: fetchedImage.contentType,
        contentLength: fetchedImage.contentLength,
      });
    }

    timer.start("unsafe_screening");
    if (!this.dependencies.featureFlags.disableModerationScreening) {
      const unsafeScreening = await moderateUnsafeImage(
        this.dependencies.openAIClient,
        fetchedImage,
        trace.requestId,
      );

      if (!unsafeScreening.allowed) {
        timer.end("unsafe_screening");
        throw new AppError(400, "INPUT_REJECTED", "Image contains unsafe or disallowed content", {
          reasonCode: unsafeScreening.reasonCode ?? "UNSAFE_IMAGE",
          stage: "unsafe_screening",
          policyFlags: unsafeScreening.policyFlags,
        });
      }
    }
    timer.end("unsafe_screening");

    timer.start("meal_inference");
    const inference = this.dependencies.featureFlags.disableInference
      ? {
          confidence: "low" as const,
          detectedItems: [],
          nutritionEstimate: null,
          uncertaintyNotes: ["Meal inference is currently unavailable."],
          clarifyingQuestion: null,
          abstainRecommended: true,
          modelFlags: [],
        }
      : await runMealInference(this.dependencies.openAIClient, request);
    timer.end("meal_inference");

    timer.start("output_guardrails");
    const output = this.dependencies.featureFlags.forceAbstain
      ? {
          status: "abstained" as const,
          policyFlags: this.appendPolicyFlag(inference.modelFlags, "FORCED_ABSTENTION"),
          abstained: true,
          reason: "FORCED_ABSTENTION",
          clarifyingQuestion: inference.clarifyingQuestion,
          changedOutcome: true,
        }
      : enforceSafetyPolicy(inference, trace.requestId);
    timer.end("output_guardrails");

    if (output.status === "ok") {
      noOpMetrics.increment("successful_analyses_total");
    }

    return MealAnalysisResponseSchema.parse(buildFinalResponse(request, inference, output));
  }

  private attachRequestId(rawRequest: unknown, requestId: string): MealAnalysisRequest {
    if (rawRequest && typeof rawRequest === "object" && !Array.isArray(rawRequest)) {
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

  private appendPolicyFlag(flags: PolicyFlag[], nextFlag: PolicyFlag): PolicyFlag[] {
    return flags.includes(nextFlag) ? flags : [...flags, nextFlag];
  }
}
