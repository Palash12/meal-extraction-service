import { logger } from "../../services/logging/logger";
import type { MetricsRecorder } from "../../services/observability/metrics";
import { noOpMetrics } from "../../services/observability/metrics";
import type { Tracer } from "../../services/observability/tracer";
import { noOpTracer } from "../../services/observability/tracer";
import type { PolicyFlag } from "../../types/api";
import type { MealInferenceResult, OutputGuardrailsResult } from "../../types/pipeline";

const MEDICAL_ADVICE_PATTERNS = [
  /\bdiagnos/i,
  /\btreat(?:ment|ing)?\b/i,
  /\bmedicat(?:ion|e|ed)\b/i,
  /\bdisease\b/i,
  /\bcondition-safe\b/i,
  /\bsafe for (?:your|this) condition\b/i,
];

export interface OutputGuardrailsDependencies {
  metrics?: MetricsRecorder;
  tracer?: Tracer;
}

function includesMedicalAdviceLikeContent(text: string | null): boolean {
  if (!text) {
    return false;
  }

  return MEDICAL_ADVICE_PATTERNS.some((pattern) => pattern.test(text));
}

function appendPolicyFlag(flags: PolicyFlag[], nextFlag: PolicyFlag): PolicyFlag[] {
  return flags.includes(nextFlag) ? flags : [...flags, nextFlag];
}

function buildChangedResult(
  requestId: string,
  result: Omit<OutputGuardrailsResult, "changedOutcome">,
  latencyMs: number,
): OutputGuardrailsResult {
  logger.outputGuardrailApplied({
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

export function enforceSafetyPolicy(
  result: MealInferenceResult,
  requestId = "unknown",
  dependencies: OutputGuardrailsDependencies = {},
): OutputGuardrailsResult {
  const startedAt = Date.now();
  const metrics = dependencies.metrics ?? noOpMetrics;
  const tracer = dependencies.tracer ?? noOpTracer;
  const policyFlags: PolicyFlag[] = [...result.modelFlags];

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

  if (
    includesMedicalAdviceLikeContent(result.clarifyingQuestion) ||
    result.modelFlags.includes("MEDICAL_ADVICE_BLOCKED")
  ) {
    metrics.increment("output_policy_blocks_total");
    metrics.increment("abstentions_total");

    return buildChangedResult(
      requestId,
      {
        status: "abstained",
        policyFlags: appendPolicyFlag(policyFlags, "MEDICAL_ADVICE_BLOCKED"),
        abstained: true,
        reason: "MEDICAL_ADVICE_BLOCKED",
        clarifyingQuestion: null,
      },
      Date.now() - startedAt,
    );
  }

  if (result.abstainRecommended || result.confidence === "low") {
    metrics.increment("abstentions_total");

    const nextFlags = appendPolicyFlag(policyFlags, "LOW_CONFIDENCE");

    return buildChangedResult(
      requestId,
      {
        status: "abstained",
        policyFlags: nextFlags,
        abstained: true,
        reason: "LOW_CONFIDENCE",
        clarifyingQuestion: result.clarifyingQuestion,
      },
      Date.now() - startedAt,
    );
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
