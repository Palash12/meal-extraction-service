import { readFileSync } from "fs";
import { join } from "path";

import type OpenAI from "openai";

import { AppError } from "../lib/errors";
import { normalizeMealInference } from "../pipeline/mealInference/normalizeMealInference";
import { mealInferenceModelJsonSchema } from "../schemas/mealInferenceModel";
import type { FeatureFlags } from "../services/config/featureFlags";
import { logger } from "../services/logging/logger";
import type { DemoObservability } from "../services/observability/demoObservability";
import type { MetricsRecorder } from "../services/observability/metrics";
import { noOpMetrics } from "../services/observability/metrics";
import type { Tracer } from "../services/observability/tracer";
import { noOpTracer } from "../services/observability/tracer";
import type { MealAnalysisRequest } from "../types/api";
import type {
  MealExtractionResult,
  UnsafeScreeningResult,
} from "../types/pipeline";

export interface OpenAIClientModels {
  inferenceModel: string;
  moderationModel: string;
  mealInferencePromptVersion?: string;
  maxOutputTokens?: number | null;
  embeddingModel?: string;
}

export interface OpenAIClientDependencies {
  metrics?: MetricsRecorder;
  tracer?: Tracer;
  demoObservability?: DemoObservability;
  featureFlags?: FeatureFlags;
}

export class OpenAIClient {
  private readonly metrics: MetricsRecorder;
  private readonly tracer: Tracer;
  private readonly demoObservability?: DemoObservability;
  private readonly featureFlags?: FeatureFlags;

  constructor(
    private readonly openai: OpenAI,
    private readonly models: OpenAIClientModels,
    dependencies: OpenAIClientDependencies = {},
    ) {
    this.metrics = dependencies.metrics ?? noOpMetrics;
    this.tracer = dependencies.tracer ?? noOpTracer;
    this.demoObservability = dependencies.demoObservability;
    this.featureFlags = dependencies.featureFlags;
  }

  getInferenceModel(): string {
    return this.models.inferenceModel;
  }

  getModerationModel(): string {
    return this.models.moderationModel;
  }

  async embedTexts(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) {
      return [];
    }

    const response = await this.openai.embeddings.create({
      model: this.models.embeddingModel ?? "text-embedding-3-small",
      input: texts,
    });

    return response.data.map((item) => item.embedding);
  }

  async screenUnsafeImage(
    imageUrl: string,
    requestId = "unknown",
  ): Promise<UnsafeScreeningResult> {
    const startedAt = Date.now();
    this.tracer.startSpan("unsafe_screening", {
      request_id: requestId,
      stage: "unsafe_screening",
      model_name: this.models.moderationModel,
    });
    this.metrics.increment("model_calls_total");

    if (this.featureFlags?.demoMode && this.featureFlags.forceUnsafeRejection) {
      this.metrics.increment("unsafe_screen_rejections_total");
      logger.unsafeContentRejected({
        request_id: requestId,
        reason_code: "UNSAFE_IMAGE",
        policy_flags: ["UNSAFE_IMAGE"],
        model_name: this.models.moderationModel,
        latency_ms: Date.now() - startedAt,
      });
      this.demoObservability?.recordModelCall({
        requestId,
        stage: "unsafe_screening",
        outcome: "blocked",
        modelName: this.models.moderationModel,
        latencyMs: Date.now() - startedAt,
        details: {
          local_demo_only: true,
          forced_rejection: true,
          policy_flag_count: 1,
        },
      });

      return {
        allowed: false,
        reasonCode: "UNSAFE_IMAGE",
        policyFlags: ["UNSAFE_IMAGE"],
      };
    }

    try {
      const response = await this.openai.moderations.create({
        model: this.models.moderationModel,
        input: [
          {
            type: "image_url",
            image_url: {
              url: imageUrl,
            },
          },
        ],
      });

      const usage = response as {
        usage?: { input_tokens?: number; output_tokens?: number };
      };
      if (usage.usage?.input_tokens) {
        this.metrics.increment(
          "model_input_tokens_total",
          usage.usage.input_tokens,
        );
      }
      if (usage.usage?.output_tokens) {
        this.metrics.increment(
          "model_output_tokens_total",
          usage.usage.output_tokens,
        );
      }

      this.metrics.histogram("stage_latency_ms", Date.now() - startedAt);

      const result = response.results[0];
      const usageDetails = {
        inputTokens: usage.usage?.input_tokens ?? null,
        outputTokens: usage.usage?.output_tokens ?? null,
      };

      if (!result?.flagged) {
        this.demoObservability?.recordModelCall({
          requestId,
          stage: "unsafe_screening",
          outcome: "allowed",
          modelName: this.models.moderationModel,
          latencyMs: Date.now() - startedAt,
          inputTokens: usageDetails.inputTokens,
          outputTokens: usageDetails.outputTokens,
        });

        return {
          allowed: true,
          reasonCode: null,
          policyFlags: [],
        };
      }

      this.metrics.increment("unsafe_screen_rejections_total");
      logger.unsafeContentRejected({
        request_id: requestId,
        reason_code: "UNSAFE_IMAGE",
        policy_flags: ["UNSAFE_IMAGE"],
        model_name: this.models.moderationModel,
        latency_ms: Date.now() - startedAt,
      });
      this.demoObservability?.recordModelCall({
        requestId,
        stage: "unsafe_screening",
        outcome: "blocked",
        modelName: this.models.moderationModel,
        latencyMs: Date.now() - startedAt,
        inputTokens: usageDetails.inputTokens,
        outputTokens: usageDetails.outputTokens,
        details: {
          policy_flag_count: 1,
        },
      });

      return {
        allowed: false,
        reasonCode: "UNSAFE_IMAGE",
        policyFlags: ["UNSAFE_IMAGE"],
      };
    } catch (error) {
      this.metrics.increment("model_failures_total");
      logger.upstreamCallFailed({
        request_id: requestId,
        upstream: "moderation",
        error_code: error instanceof Error ? error.name : "UNKNOWN_ERROR",
        retryable: false,
        attempt: 1,
        latency_ms: Date.now() - startedAt,
      });
      this.demoObservability?.recordStageDecision({
        requestId,
        stage: "unsafe_screening",
        outcome: "error",
        reasonCode: "UPSTREAM_INFERENCE_FAILURE",
        modelName: this.models.moderationModel,
        latencyMs: Date.now() - startedAt,
      });
      throw new AppError(
        502,
        "UPSTREAM_INFERENCE_FAILURE",
        "Unsafe image screening failed",
      );
    }
  }

  async inferMeal(request: MealAnalysisRequest): Promise<MealExtractionResult> {
    const startedAt = Date.now();
    this.tracer.startSpan("meal_inference", {
      request_id: request.request_id ?? "unknown",
      stage: "meal_inference",
      model_name: this.models.inferenceModel,
      prompt_version: this.getPromptVersion(),
    });
    this.metrics.increment("model_calls_total");
    this.metrics.increment("inference_calls_per_request", 1);

    try {
      if (this.featureFlags?.demoMode && this.featureFlags.forceInferenceFailure) {
        throw new Error("DEMO_FORCED_INFERENCE_FAILURE");
      }

      const response = await this.openai.responses.create({
        model: this.models.inferenceModel,
        store: false,
        stream: false,
        input: [
          {
            role: "developer",
            content: [
              {
                type: "input_text",
                text: this.loadMealInferencePrompt(),
              },
            ],
          },
          {
            role: "user",
            content: [
              {
                type: "input_text",
                text: request.user_note
                  ? `User note: ${request.user_note}`
                  : "Analyze the provided meal image.",
              },
              {
                type: "input_image",
                image_url: request.image_url,
                detail: "high",
              },
            ],
          },
        ],
        text: {
          format: {
            type: "json_schema",
            name: "meal_inference",
            schema: mealInferenceModelJsonSchema,
            strict: true,
          },
        },
        max_output_tokens: this.models.maxOutputTokens ?? undefined,
      });

      const usage = response as {
        usage?: { input_tokens?: number; output_tokens?: number };
      };
      if (usage.usage?.input_tokens) {
        this.metrics.increment(
          "model_input_tokens_total",
          usage.usage.input_tokens,
        );
      }
      if (usage.usage?.output_tokens) {
        this.metrics.increment(
          "model_output_tokens_total",
          usage.usage.output_tokens,
        );
      }

      const latencyMs = Date.now() - startedAt;
      this.metrics.histogram("stage_latency_ms", latencyMs);

      const normalized = normalizeMealInference(
        this.extractInferencePayload(response),
      );
      const inputTokens = usage.usage?.input_tokens ?? null;
      const outputTokens = usage.usage?.output_tokens ?? null;

      this.demoObservability?.recordModelCall({
        requestId: request.request_id ?? "unknown",
        stage: "meal_inference",
        outcome: "completed",
        modelName: this.models.inferenceModel,
        promptVersion: this.getPromptVersion(),
        latencyMs,
        inputTokens,
        outputTokens,
      });
      this.demoObservability?.recordInferenceSummary(
        request.request_id ?? "unknown",
        {
          confidenceLevel: normalized.confidence,
          abstainRecommended: normalized.abstainRecommended,
          detectedItemCount: normalized.detectedItems.length,
          policyFlagCount: normalized.modelFlags.length,
          hasClarifyingQuestion: normalized.clarifyingQuestion !== null,
          nutritionEstimatePresent: false,
          modelName: this.models.inferenceModel,
          promptVersion: this.getPromptVersion(),
        },
      );

      return normalized;
    } catch (error) {
      this.metrics.increment("model_failures_total");
      logger.upstreamCallFailed({
        request_id: request.request_id ?? "unknown",
        upstream: "inference",
        error_code: error instanceof Error ? error.name : "UNKNOWN_ERROR",
        retryable: false,
        attempt: 1,
        latency_ms: Date.now() - startedAt,
      });
      this.demoObservability?.recordStageDecision({
        requestId: request.request_id ?? "unknown",
        stage: "meal_inference",
        outcome: "error",
        reasonCode: "UPSTREAM_INFERENCE_FAILURE",
        modelName: this.models.inferenceModel,
        promptVersion: this.getPromptVersion(),
        latencyMs: Date.now() - startedAt,
      });
      throw new AppError(
        502,
        "UPSTREAM_INFERENCE_FAILURE",
        "Meal inference failed",
      );
    }
  }

  private extractInferencePayload(
    response: Awaited<ReturnType<OpenAI["responses"]["create"]>>,
  ): unknown {
    if (
      "output_text" in response &&
      typeof response.output_text === "string" &&
      response.output_text.trim().length > 0
    ) {
      return JSON.parse(response.output_text);
    }

    if ("output" in response) {
      for (const item of response.output ?? []) {
        if (!("content" in item) || !Array.isArray(item.content)) {
          continue;
        }

        for (const contentItem of item.content) {
          if (
            typeof contentItem === "object" &&
            contentItem !== null &&
            "type" in contentItem &&
            contentItem.type === "output_text" &&
            "text" in contentItem &&
            typeof contentItem.text === "string"
          ) {
            return JSON.parse(contentItem.text);
          }
        }
      }
    }

    throw new AppError(
      502,
      "UPSTREAM_INFERENCE_FAILURE",
      "Meal inference returned no structured output",
    );
  }

  private getPromptVersion(): string {
    return this.models.mealInferencePromptVersion ?? "mealNutritionEstimate.v1";
  }

  private loadMealInferencePrompt(): string {
    return readFileSync(
      join(
        process.cwd(),
        "src",
        "prompts",
        "mealInference",
        `${this.getPromptVersion()}.txt`,
      ),
      "utf8",
    );
  }
}
