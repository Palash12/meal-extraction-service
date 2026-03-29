import type { FeatureFlags } from "../../types/config";
import { env } from "../../config/env";

export type { FeatureFlags } from "../../types/config";

export const featureFlags: FeatureFlags = {
  demoMode: env.DEMO_MODE,
  decisionLoggingEnabled: env.DECISION_LOGGING_ENABLED,
  enableUnsafeScreening: env.ENABLE_UNSAFE_SCREENING,
  enableOutputGuardrails: env.ENABLE_OUTPUT_GUARDRAILS,
  forceAbstainOnLowConfidence: env.FORCE_ABSTAIN_ON_LOW_CONFIDENCE,
  inferenceModelOverride: env.DEMO_MODE
    ? (env.INFERENCE_MODEL_OVERRIDE ?? null)
    : null,
  fetchTimeoutMsOverride: env.DEMO_MODE ? (env.FETCH_TIMEOUT_MS ?? null) : null,
  maxFetchSizeMbOverride: env.DEMO_MODE
    ? (env.MAX_FETCH_SIZE_MB ?? null)
    : null,
  maxOutputTokensOverride: env.DEMO_MODE
    ? (env.MAX_OUTPUT_TOKENS ?? null)
    : null,
  forceUnsafeRejection:
    env.DEMO_MODE && env.DEMO_FORCE_UNSAFE_REJECTION,
  forceInferenceFailure:
    env.DEMO_MODE && env.DEMO_FORCE_INFERENCE_FAILURE,
};
