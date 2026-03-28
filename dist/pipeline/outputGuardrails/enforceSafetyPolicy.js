"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.enforceSafetyPolicy = enforceSafetyPolicy;
const logger_1 = require("../../services/logging/logger");
const metrics_1 = require("../../services/observability/metrics");
const tracer_1 = require("../../services/observability/tracer");
const MEDICAL_ADVICE_PATTERNS = [
    /\bdiagnos/i,
    /\btreat(?:ment|ing)?\b/i,
    /\bmedicat(?:ion|e|ed)\b/i,
    /\bdisease\b/i,
    /\bcondition-safe\b/i,
    /\bsafe for (?:your|this) condition\b/i,
];
function includesMedicalAdviceLikeContent(text) {
    if (!text) {
        return false;
    }
    return MEDICAL_ADVICE_PATTERNS.some((pattern) => pattern.test(text));
}
function appendPolicyFlag(flags, nextFlag) {
    return flags.includes(nextFlag) ? flags : [...flags, nextFlag];
}
function buildChangedResult(requestId, result, latencyMs) {
    logger_1.logger.outputGuardrailApplied({
        request_id: requestId,
        policy_flags: result.policyFlags,
        abstained: result.abstained,
        reason_code: result.reason,
        latency_ms: latencyMs,
    });
    return {
        ...result,
        changedOutcome: true,
    };
}
function enforceSafetyPolicy(result, requestId = "unknown", dependencies = {}) {
    const startedAt = Date.now();
    const metrics = dependencies.metrics ?? metrics_1.noOpMetrics;
    const tracer = dependencies.tracer ?? tracer_1.noOpTracer;
    const policyFlags = [...result.modelFlags];
    tracer.startSpan("output_guardrails", {
        request_id: requestId,
        stage: "output_guardrails",
        confidence_level: result.confidence,
    });
    if (result.confidence === "low") {
        metrics.increment("low_confidence_responses_total");
    }
    if (result.nutritionEstimate === null) {
        metrics.increment("null_estimate_responses_total");
    }
    if (includesMedicalAdviceLikeContent(result.clarifyingQuestion) ||
        result.modelFlags.includes("MEDICAL_ADVICE_BLOCKED")) {
        metrics.increment("output_policy_blocks_total");
        metrics.increment("abstentions_total");
        return buildChangedResult(requestId, {
            status: "abstained",
            policyFlags: appendPolicyFlag(policyFlags, "MEDICAL_ADVICE_BLOCKED"),
            abstained: true,
            reason: "MEDICAL_ADVICE_BLOCKED",
            clarifyingQuestion: null,
        }, Date.now() - startedAt);
    }
    if (result.abstainRecommended || result.confidence === "low") {
        metrics.increment("abstentions_total");
        const nextFlags = appendPolicyFlag(policyFlags, "LOW_CONFIDENCE");
        return buildChangedResult(requestId, {
            status: "abstained",
            policyFlags: nextFlags,
            abstained: true,
            reason: "LOW_CONFIDENCE",
            clarifyingQuestion: result.clarifyingQuestion,
        }, Date.now() - startedAt);
    }
    if (result.clarifyingQuestion) {
        metrics.increment("clarifications_total");
    }
    return {
        status: "ok",
        policyFlags,
        abstained: false,
        reason: null,
        clarifyingQuestion: result.clarifyingQuestion,
        changedOutcome: false,
    };
}
