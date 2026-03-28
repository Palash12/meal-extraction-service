"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MealAnalysisOrchestrator = void 0;
const crypto_1 = require("crypto");
const errors_1 = require("../../lib/errors");
const mealAnalysisResponse_1 = require("../../schemas/mealAnalysisResponse");
const buildFinalResponse_1 = require("../outputGuardrails/buildFinalResponse");
const enforceSafetyPolicy_1 = require("../outputGuardrails/enforceSafetyPolicy");
const stageTimer_1 = require("../../services/observability/stageTimer");
const modelTrace_1 = require("../../services/observability/modelTrace");
const metrics_1 = require("../../services/observability/metrics");
const tracer_1 = require("../../services/observability/tracer");
const assessImageUsability_1 = require("../inputGuardrails/assessImageUsability");
const fetchImageMetadata_1 = require("../inputGuardrails/fetchImageMetadata");
const validateRequest_1 = require("../inputGuardrails/validateRequest");
const mealInferenceStage_1 = require("../mealInference/mealInferenceStage");
const moderateUnsafeImage_1 = require("../unsafeScreening/moderateUnsafeImage");
class MealAnalysisOrchestrator {
    dependencies;
    constructor(dependencies) {
        this.dependencies = dependencies;
    }
    async analyze(rawRequest, requestId) {
        const resolvedRequestId = this.resolveRequestId(rawRequest, requestId);
        const timer = (0, stageTimer_1.createStageTimer)();
        const trace = (0, modelTrace_1.createTraceContext)({
            requestId: resolvedRequestId,
            inferenceModel: this.dependencies.openAIClient.getInferenceModel(),
            moderationModel: this.dependencies.openAIClient.getModerationModel(),
            promptVersion: "mealNutritionEstimate.v1",
        });
        tracer_1.noOpTracer.startSpan("http.request", {
            request_id: trace.requestId,
        });
        const request = (0, validateRequest_1.validateRequestInput)(this.attachRequestId(rawRequest, resolvedRequestId));
        timer.start("input_guardrails");
        tracer_1.noOpTracer.startSpan("input_guardrails", {
            request_id: trace.requestId,
            stage: "input_guardrails",
        });
        const fetchedImage = await (0, fetchImageMetadata_1.fetchImageMetadata)(this.dependencies.imageFetchClient, request.image_url, trace.requestId);
        const inputGuardrails = (0, assessImageUsability_1.assessImageUsability)(fetchedImage);
        timer.end("input_guardrails");
        if (!inputGuardrails.accepted) {
            throw new errors_1.AppError(400, "INPUT_REJECTED", inputGuardrails.rejectionReason ?? "Input rejected", {
                reasonCode: inputGuardrails.rejectionCode ?? "INPUT_REJECTED",
                stage: "input_guardrails",
                contentType: fetchedImage.contentType,
                contentLength: fetchedImage.contentLength,
            });
        }
        timer.start("unsafe_screening");
        if (!this.dependencies.featureFlags.disableModerationScreening) {
            const unsafeScreening = await (0, moderateUnsafeImage_1.moderateUnsafeImage)(this.dependencies.openAIClient, fetchedImage, trace.requestId);
            if (!unsafeScreening.allowed) {
                timer.end("unsafe_screening");
                throw new errors_1.AppError(400, "INPUT_REJECTED", "Image contains unsafe or disallowed content", {
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
                confidence: "low",
                detectedItems: [],
                nutritionEstimate: null,
                uncertaintyNotes: ["Meal inference is currently unavailable."],
                clarifyingQuestion: null,
                abstainRecommended: true,
                modelFlags: [],
            }
            : await (0, mealInferenceStage_1.runMealInference)(this.dependencies.openAIClient, request);
        timer.end("meal_inference");
        timer.start("output_guardrails");
        const output = this.dependencies.featureFlags.forceAbstain
            ? {
                status: "abstained",
                policyFlags: this.appendPolicyFlag(inference.modelFlags, "FORCED_ABSTENTION"),
                abstained: true,
                reason: "FORCED_ABSTENTION",
                clarifyingQuestion: inference.clarifyingQuestion,
                changedOutcome: true,
            }
            : (0, enforceSafetyPolicy_1.enforceSafetyPolicy)(inference, trace.requestId);
        timer.end("output_guardrails");
        if (output.status === "ok") {
            metrics_1.noOpMetrics.increment("successful_analyses_total");
        }
        return mealAnalysisResponse_1.MealAnalysisResponseSchema.parse((0, buildFinalResponse_1.buildFinalResponse)(request, inference, output));
    }
    attachRequestId(rawRequest, requestId) {
        if (rawRequest && typeof rawRequest === "object" && !Array.isArray(rawRequest)) {
            return {
                ...rawRequest,
                request_id: requestId,
            };
        }
        return {
            image_url: "",
            request_id: requestId,
        };
    }
    resolveRequestId(rawRequest, requestId) {
        if (requestId) {
            return requestId;
        }
        if (rawRequest &&
            typeof rawRequest === "object" &&
            "request_id" in rawRequest &&
            typeof rawRequest.request_id === "string" &&
            rawRequest.request_id.trim().length > 0) {
            return rawRequest.request_id;
        }
        return (0, crypto_1.randomUUID)();
    }
    appendPolicyFlag(flags, nextFlag) {
        return flags.includes(nextFlag) ? flags : [...flags, nextFlag];
    }
}
exports.MealAnalysisOrchestrator = MealAnalysisOrchestrator;
