import type { ConfidenceLevel } from "../../types/api";
import type { FeatureFlags } from "../../types/config";
import { featureFlags } from "../config/featureFlags";

type DemoStage =
  | "orchestrator"
  | "input_guardrails"
  | "image_fetch"
  | "unsafe_screening"
  | "meal_inference"
  | "nutrition_grounding"
  | "output_guardrails";

type DemoOutcome =
  | "started"
  | "accepted"
  | "rejected"
  | "allowed"
  | "blocked"
  | "abstained"
  | "passed"
  | "skipped"
  | "completed"
  | "error";

interface DemoFeatureFlagsSnapshot {
  demo_mode: boolean;
  decision_logging_enabled: boolean;
  enable_unsafe_screening: boolean;
  enable_output_guardrails: boolean;
  force_abstain_on_low_confidence: boolean;
  inference_model_override: string | null;
  fetch_timeout_ms_override: number | null;
  max_fetch_size_mb_override: number | null;
  max_output_tokens_override: number | null;
  force_unsafe_rejection: boolean;
  force_inference_failure: boolean;
}

interface DemoEventBase {
  event: string;
  request_id?: string;
  stage?: DemoStage;
  outcome?: DemoOutcome;
  reason_code?: string | null;
  confidence_level?: ConfidenceLevel | null;
  model_name?: string | null;
  prompt_version?: string | null;
  latency_ms?: number;
  input_tokens?: number | null;
  output_tokens?: number | null;
  estimated_cost_usd?: number | null;
  active_feature_flags?: DemoFeatureFlagsSnapshot;
  details?: Record<string, number | string | boolean | null>;
}

interface StageLatencyAggregate {
  count: number;
  totalLatencyMs: number;
}

interface TokenAggregate {
  inputTokens: number;
  outputTokens: number;
  estimatedCostUsd: number;
}

interface DemoAggregate {
  requestsTotal: number;
  successfulAnalyses: number;
  abstentions: number;
  unsafeRejections: number;
  policyBlocks: number;
  inputRejections: number;
  moderationCalls: number;
  inferenceCalls: number;
  stageLatency: Partial<Record<DemoStage, StageLatencyAggregate>>;
  tokensByStage: Partial<
    Record<"unsafe_screening" | "meal_inference", TokenAggregate>
  >;
}

interface StageDecisionInput {
  requestId: string;
  stage: DemoStage;
  outcome: DemoOutcome;
  reasonCode?: string | null;
  confidenceLevel?: ConfidenceLevel | null;
  modelName?: string | null;
  promptVersion?: string | null;
  latencyMs?: number;
  details?: Record<string, number | string | boolean | null>;
}

interface ModelCallInput {
  requestId: string;
  stage: "unsafe_screening" | "meal_inference";
  outcome: DemoOutcome;
  modelName: string;
  promptVersion?: string | null;
  latencyMs: number;
  inputTokens?: number | null;
  outputTokens?: number | null;
  details?: Record<string, number | string | boolean | null>;
}

interface RequestOutcomeInput {
  requestId: string;
  outcome: "accepted" | "rejected" | "abstained" | "error";
  reasonCode?: string | null;
  confidenceLevel?: ConfidenceLevel | null;
  latencyMs?: number;
}

const ZERO_AGGREGATE: DemoAggregate = {
  requestsTotal: 0,
  successfulAnalyses: 0,
  abstentions: 0,
  unsafeRejections: 0,
  policyBlocks: 0,
  inputRejections: 0,
  moderationCalls: 0,
  inferenceCalls: 0,
  stageLatency: {},
  tokensByStage: {},
};

// Demo-only pricing table for relative tradeoff discussion. Do not use for billing.
const DEMO_MODEL_PRICING_USD_PER_1K_TOKENS: Record<
  string,
  { input: number; output: number }
> = {
  "gpt-5.4-mini": { input: 0.00015, output: 0.0006 },
  "gpt-5.4": { input: 0.00125, output: 0.005 },
  "omni-moderation-latest": { input: 0.0001, output: 0 },
};

function formatRate(numerator: number, denominator: number): number {
  if (denominator === 0) {
    return 0;
  }

  return Number((numerator / denominator).toFixed(4));
}

function roundCost(costUsd: number | null): number | null {
  if (costUsd === null) {
    return null;
  }

  return Number(costUsd.toFixed(6));
}

function createFeatureFlagSnapshot(
  featureFlags: FeatureFlags,
): DemoFeatureFlagsSnapshot {
  return {
    demo_mode: featureFlags.demoMode,
    decision_logging_enabled: featureFlags.decisionLoggingEnabled,
    enable_unsafe_screening: featureFlags.enableUnsafeScreening,
    enable_output_guardrails: featureFlags.enableOutputGuardrails,
    force_abstain_on_low_confidence: featureFlags.forceAbstainOnLowConfidence,
    inference_model_override: featureFlags.inferenceModelOverride,
    fetch_timeout_ms_override: featureFlags.fetchTimeoutMsOverride,
    max_fetch_size_mb_override: featureFlags.maxFetchSizeMbOverride,
    max_output_tokens_override: featureFlags.maxOutputTokensOverride,
    force_unsafe_rejection: featureFlags.forceUnsafeRejection,
    force_inference_failure: featureFlags.forceInferenceFailure,
  };
}

function estimateCostUsd(
  modelName: string,
  inputTokens?: number | null,
  outputTokens?: number | null,
): number | null {
  const pricing = DEMO_MODEL_PRICING_USD_PER_1K_TOKENS[modelName];
  if (!pricing) {
    return null;
  }

  const inputCost = ((inputTokens ?? 0) / 1_000) * pricing.input;
  const outputCost = ((outputTokens ?? 0) / 1_000) * pricing.output;
  return roundCost(inputCost + outputCost);
}

function emitDemoEvent(event: DemoEventBase): void {
  console.log(
    JSON.stringify({
      timestamp: new Date().toISOString(),
      ...event,
    }),
  );
}

export class DemoObservability {
  private readonly aggregate: DemoAggregate = structuredClone(ZERO_AGGREGATE);
  private readonly featureFlagSnapshot: DemoFeatureFlagsSnapshot;

  constructor(private readonly featureFlags: FeatureFlags) {
    this.featureFlagSnapshot = createFeatureFlagSnapshot(featureFlags);
  }

  isEnabled(): boolean {
    return this.featureFlags.demoMode;
  }

  isDecisionLoggingEnabled(): boolean {
    return (
      this.featureFlags.demoMode && this.featureFlags.decisionLoggingEnabled
    );
  }

  getSafeFeatureFlagSnapshot(): DemoFeatureFlagsSnapshot {
    return this.featureFlagSnapshot;
  }

  recordRequestStarted(requestId: string): void {
    if (!this.isEnabled()) {
      return;
    }

    this.aggregate.requestsTotal += 1;

    if (!this.isDecisionLoggingEnabled()) {
      return;
    }

    emitDemoEvent({
      event: "demo_feature_flags",
      request_id: requestId,
      stage: "orchestrator",
      outcome: "started",
      active_feature_flags: this.featureFlagSnapshot,
    });
  }

  recordStageDecision(input: StageDecisionInput): void {
    if (!this.isEnabled()) {
      return;
    }

    if (typeof input.latencyMs === "number") {
      const aggregate = this.aggregate.stageLatency[input.stage] ?? {
        count: 0,
        totalLatencyMs: 0,
      };
      aggregate.count += 1;
      aggregate.totalLatencyMs += input.latencyMs;
      this.aggregate.stageLatency[input.stage] = aggregate;
    }

    if (!this.isDecisionLoggingEnabled()) {
      return;
    }

    emitDemoEvent({
      event: "demo_stage_decision",
      request_id: input.requestId,
      stage: input.stage,
      outcome: input.outcome,
      reason_code: input.reasonCode ?? null,
      confidence_level: input.confidenceLevel ?? null,
      model_name: input.modelName ?? null,
      prompt_version: input.promptVersion ?? null,
      latency_ms: input.latencyMs,
      details: input.details,
    });
  }

  recordModelCall(input: ModelCallInput): void {
    if (!this.isEnabled()) {
      return;
    }

    if (input.stage === "unsafe_screening") {
      this.aggregate.moderationCalls += 1;
    } else {
      this.aggregate.inferenceCalls += 1;
    }

    const aggregate = this.aggregate.tokensByStage[input.stage] ?? {
      inputTokens: 0,
      outputTokens: 0,
      estimatedCostUsd: 0,
    };
    aggregate.inputTokens += input.inputTokens ?? 0;
    aggregate.outputTokens += input.outputTokens ?? 0;
    aggregate.estimatedCostUsd +=
      estimateCostUsd(input.modelName, input.inputTokens, input.outputTokens) ??
      0;
    this.aggregate.tokensByStage[input.stage] = aggregate;

    if (!this.isDecisionLoggingEnabled()) {
      return;
    }

    emitDemoEvent({
      event: "demo_model_call",
      request_id: input.requestId,
      stage: input.stage,
      outcome: input.outcome,
      model_name: input.modelName,
      prompt_version: input.promptVersion ?? null,
      latency_ms: input.latencyMs,
      input_tokens: input.inputTokens ?? null,
      output_tokens: input.outputTokens ?? null,
      estimated_cost_usd: estimateCostUsd(
        input.modelName,
        input.inputTokens,
        input.outputTokens,
      ),
      details: input.details,
    });
  }

  recordInferenceSummary(
    requestId: string,
    summary: {
      confidenceLevel: ConfidenceLevel;
      abstainRecommended: boolean;
      detectedItemCount: number;
      policyFlagCount: number;
      hasClarifyingQuestion: boolean;
      nutritionEstimatePresent: boolean;
      modelName: string;
      promptVersion: string;
    },
  ): void {
    if (!this.isDecisionLoggingEnabled()) {
      return;
    }

    emitDemoEvent({
      event: "demo_inference_summary",
      request_id: requestId,
      stage: "meal_inference",
      outcome: "completed",
      confidence_level: summary.confidenceLevel,
      model_name: summary.modelName,
      prompt_version: summary.promptVersion,
      details: {
        abstain_recommended: summary.abstainRecommended,
        detected_item_count: summary.detectedItemCount,
        policy_flag_count: summary.policyFlagCount,
        has_clarifying_question: summary.hasClarifyingQuestion,
        nutrition_estimate_present: summary.nutritionEstimatePresent,
      },
    });
  }

  recordRequestOutcome(input: RequestOutcomeInput): void {
    if (!this.isEnabled()) {
      return;
    }

    if (input.outcome === "accepted") {
      this.aggregate.successfulAnalyses += 1;
    }
    if (input.outcome === "abstained") {
      this.aggregate.abstentions += 1;
    }
    if (input.outcome === "rejected") {
      this.aggregate.inputRejections += 1;
    }
    if (input.reasonCode === "UNSAFE_IMAGE") {
      this.aggregate.unsafeRejections += 1;
    }
    if (input.reasonCode === "MEDICAL_ADVICE_BLOCKED") {
      this.aggregate.policyBlocks += 1;
    }

    if (this.isDecisionLoggingEnabled()) {
      emitDemoEvent({
        event: "demo_request_outcome",
        request_id: input.requestId,
        stage: "orchestrator",
        outcome: input.outcome,
        reason_code: input.reasonCode ?? null,
        confidence_level: input.confidenceLevel ?? null,
        latency_ms: input.latencyMs,
        active_feature_flags: this.featureFlagSnapshot,
      });
    }

    emitDemoEvent({
      event: "demo_tradeoff_snapshot",
      request_id: input.requestId,
      stage: "orchestrator",
      outcome: input.outcome,
      details: {
        requests_total: this.aggregate.requestsTotal,
        successful_analysis_rate: formatRate(
          this.aggregate.successfulAnalyses,
          this.aggregate.requestsTotal,
        ),
        abstention_rate: formatRate(
          this.aggregate.abstentions,
          this.aggregate.requestsTotal,
        ),
        unsafe_rejection_rate: formatRate(
          this.aggregate.unsafeRejections,
          this.aggregate.requestsTotal,
        ),
        policy_block_rate: formatRate(
          this.aggregate.policyBlocks,
          this.aggregate.requestsTotal,
        ),
        moderation_call_count: this.aggregate.moderationCalls,
        inference_call_count: this.aggregate.inferenceCalls,
        unsafe_screening_input_tokens:
          this.aggregate.tokensByStage.unsafe_screening?.inputTokens ?? 0,
        unsafe_screening_output_tokens:
          this.aggregate.tokensByStage.unsafe_screening?.outputTokens ?? 0,
        meal_inference_input_tokens:
          this.aggregate.tokensByStage.meal_inference?.inputTokens ?? 0,
        meal_inference_output_tokens:
          this.aggregate.tokensByStage.meal_inference?.outputTokens ?? 0,
        unsafe_screening_estimated_cost_usd:
          roundCost(
            this.aggregate.tokensByStage.unsafe_screening?.estimatedCostUsd ??
              0,
          ) ?? 0,
        meal_inference_estimated_cost_usd:
          roundCost(
            this.aggregate.tokensByStage.meal_inference?.estimatedCostUsd ?? 0,
          ) ?? 0,
      },
    });
  }
}

export const demoObservability = new DemoObservability(featureFlags);
