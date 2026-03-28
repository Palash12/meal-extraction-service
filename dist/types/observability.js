"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.logEventTypes = exports.traceSpanNames = exports.metricNames = void 0;
exports.metricNames = [
    "requests_total",
    "request_latency_ms",
    "stage_latency_ms",
    "fetch_timeout_total",
    "upstream_timeout_total",
    "model_calls_total",
    "model_input_tokens_total",
    "model_output_tokens_total",
    "model_failures_total",
    "inference_calls_per_request",
    "input_rejections_total",
    "unsafe_screen_rejections_total",
    "output_policy_blocks_total",
    "abstentions_total",
    "clarifications_total",
    "successful_analyses_total",
    "low_confidence_responses_total",
    "null_estimate_responses_total",
    "confidence_distribution_total",
];
exports.traceSpanNames = [
    "http.request",
    "input_guardrails",
    "image_fetch",
    "unsafe_screening",
    "meal_inference",
    "output_guardrails",
    "response_finalize",
];
exports.logEventTypes = [
    "request_completed",
    "input_rejected",
    "unsafe_content_rejected",
    "output_guardrail_applied",
    "upstream_call_failed",
];
