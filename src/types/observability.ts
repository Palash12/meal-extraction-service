export const metricNames = [
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
] as const;

export type MetricName = (typeof metricNames)[number];

export const traceSpanNames = [
  "http.request",
  "input_guardrails",
  "image_fetch",
  "unsafe_screening",
  "meal_inference",
  "output_guardrails",
  "response_finalize",
] as const;

export type TraceSpanName = (typeof traceSpanNames)[number];

export const logEventTypes = [
  "request_completed",
  "input_rejected",
  "unsafe_content_rejected",
  "output_guardrail_applied",
  "upstream_call_failed",
] as const;

export type LogEventType = (typeof logEventTypes)[number];

export interface RequestCompletedLogEvent {
  event: "request_completed";
  request_id: string;
  http_status: number;
  result_status: "ok" | "abstained" | "rejected_input" | "error";
  total_latency_ms: number;
  abstained: boolean;
  policy_flag_count: number;
}

export interface InputRejectedLogEvent {
  event: "input_rejected";
  request_id: string;
  reason_code: string;
  stage: "request_validation" | "input_guardrails";
  content_type?: string;
  content_length_bucket?: string;
  latency_ms?: number;
}

export interface UnsafeContentRejectedLogEvent {
  event: "unsafe_content_rejected";
  request_id: string;
  reason_code: string;
  policy_flags: string[];
  model_name: string;
  latency_ms?: number;
}

export interface OutputGuardrailAppliedLogEvent {
  event: "output_guardrail_applied";
  request_id: string;
  policy_flags: string[];
  abstained: boolean;
  reason_code: string | null;
  latency_ms?: number;
}

export interface UpstreamCallFailedLogEvent {
  event: "upstream_call_failed";
  request_id: string;
  upstream: "moderation" | "inference" | "internal";
  error_code: string;
  retryable: boolean;
  attempt: number;
  latency_ms?: number;
}

export type StructuredLogEvent =
  | RequestCompletedLogEvent
  | InputRejectedLogEvent
  | UnsafeContentRejectedLogEvent
  | OutputGuardrailAppliedLogEvent
  | UpstreamCallFailedLogEvent;

export interface MetricTags {
  stage?:
    | "input_guardrails"
    | "image_fetch"
    | "unsafe_screening"
    | "meal_inference"
    | "output_guardrails";
  upstream?: "moderation" | "inference";
  type?: "moderation" | "meal_inference";
  model?: string;
  prompt_version?: string;
  reason?: string;
  error_class?: string;
  policy_flag?: string;
  level?: "low" | "medium" | "high";
}

export interface TraceSpanAttributes {
  request_id: string;
  stage?: string;
  result?: string;
  error_code?: string;
  model_name?: string;
  prompt_version?: string;
  policy_flag_count?: number;
  abstained?: boolean;
  confidence_level?: "low" | "medium" | "high";
}
