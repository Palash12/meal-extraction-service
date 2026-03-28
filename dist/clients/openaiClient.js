"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OpenAIClient = void 0;
const fs_1 = require("fs");
const path_1 = require("path");
const errors_1 = require("../lib/errors");
const normalizeMealInference_1 = require("../pipeline/mealInference/normalizeMealInference");
const mealInferenceModel_1 = require("../schemas/mealInferenceModel");
const logger_1 = require("../services/logging/logger");
const metrics_1 = require("../services/observability/metrics");
const tracer_1 = require("../services/observability/tracer");
class OpenAIClient {
    openai;
    models;
    metrics;
    tracer;
    constructor(openai, models, dependencies = {}) {
        this.openai = openai;
        this.models = models;
        this.metrics = dependencies.metrics ?? metrics_1.noOpMetrics;
        this.tracer = dependencies.tracer ?? tracer_1.noOpTracer;
    }
    getInferenceModel() {
        return this.models.inferenceModel;
    }
    getModerationModel() {
        return this.models.moderationModel;
    }
    async screenUnsafeImage(imageUrl, requestId = "unknown") {
        const startedAt = Date.now();
        this.tracer.startSpan("unsafe_screening", {
            request_id: requestId,
            stage: "unsafe_screening",
            model_name: this.models.moderationModel,
        });
        this.metrics.increment("model_calls_total");
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
            const usage = response;
            if (usage.usage?.input_tokens) {
                this.metrics.increment("model_input_tokens_total", usage.usage.input_tokens);
            }
            if (usage.usage?.output_tokens) {
                this.metrics.increment("model_output_tokens_total", usage.usage.output_tokens);
            }
            this.metrics.histogram("stage_latency_ms", Date.now() - startedAt);
            const result = response.results[0];
            if (!result?.flagged) {
                return {
                    allowed: true,
                    reasonCode: null,
                    policyFlags: [],
                };
            }
            this.metrics.increment("unsafe_screen_rejections_total");
            logger_1.logger.unsafeContentRejected({
                request_id: requestId,
                reason_code: "UNSAFE_IMAGE",
                policy_flags: ["UNSAFE_IMAGE"],
                model_name: this.models.moderationModel,
                latency_ms: Date.now() - startedAt,
            });
            return {
                allowed: false,
                reasonCode: "UNSAFE_IMAGE",
                policyFlags: ["UNSAFE_IMAGE"],
            };
        }
        catch (error) {
            this.metrics.increment("model_failures_total");
            logger_1.logger.upstreamCallFailed({
                request_id: requestId,
                upstream: "moderation",
                error_code: error instanceof Error ? error.name : "UNKNOWN_ERROR",
                retryable: false,
                attempt: 1,
                latency_ms: Date.now() - startedAt,
            });
            throw new errors_1.AppError(502, "UPSTREAM_INFERENCE_FAILURE", "Unsafe image screening failed");
        }
    }
    async inferMeal(request) {
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
                                text: request.user_note ? `User note: ${request.user_note}` : "Analyze the provided meal image.",
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
                        schema: mealInferenceModel_1.mealInferenceModelJsonSchema,
                        strict: true,
                    },
                },
            });
            const usage = response;
            if (usage.usage?.input_tokens) {
                this.metrics.increment("model_input_tokens_total", usage.usage.input_tokens);
            }
            if (usage.usage?.output_tokens) {
                this.metrics.increment("model_output_tokens_total", usage.usage.output_tokens);
            }
            this.metrics.histogram("stage_latency_ms", Date.now() - startedAt);
            return (0, normalizeMealInference_1.normalizeMealInference)(this.extractInferencePayload(response));
        }
        catch (error) {
            this.metrics.increment("model_failures_total");
            logger_1.logger.upstreamCallFailed({
                request_id: request.request_id ?? "unknown",
                upstream: "inference",
                error_code: error instanceof Error ? error.name : "UNKNOWN_ERROR",
                retryable: false,
                attempt: 1,
                latency_ms: Date.now() - startedAt,
            });
            throw new errors_1.AppError(502, "UPSTREAM_INFERENCE_FAILURE", "Meal inference failed");
        }
    }
    extractInferencePayload(response) {
        if ("output_text" in response &&
            typeof response.output_text === "string" &&
            response.output_text.trim().length > 0) {
            return JSON.parse(response.output_text);
        }
        if ("output" in response) {
            for (const item of response.output ?? []) {
                if (!("content" in item) || !Array.isArray(item.content)) {
                    continue;
                }
                for (const contentItem of item.content) {
                    if (typeof contentItem === "object" &&
                        contentItem !== null &&
                        "type" in contentItem &&
                        contentItem.type === "output_text" &&
                        "text" in contentItem &&
                        typeof contentItem.text === "string") {
                        return JSON.parse(contentItem.text);
                    }
                }
            }
        }
        throw new errors_1.AppError(502, "UPSTREAM_INFERENCE_FAILURE", "Meal inference returned no structured output");
    }
    getPromptVersion() {
        return this.models.mealInferencePromptVersion ?? "mealNutritionEstimate.v1";
    }
    loadMealInferencePrompt() {
        return (0, fs_1.readFileSync)((0, path_1.join)(process.cwd(), "src", "prompts", "mealInference", `${this.getPromptVersion()}.txt`), "utf8");
    }
}
exports.OpenAIClient = OpenAIClient;
