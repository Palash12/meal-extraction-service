export type AllowedImageScheme = "https";

export type AllowedImageContentType = "image/jpeg" | "image/png" | "image/webp";

export interface FetchPolicyConfig {
  allowedSchemes: AllowedImageScheme[];
  redirectLimit: number;
  maxContentLengthBytes: number;
  connectionTimeoutMs: number;
  readTimeoutMs: number;
  allowedContentTypes: AllowedImageContentType[];
}

export interface ModelConfig {
  inferenceModel: string;
  moderationModel: string;
  mealInferencePromptVersion: string;
  maxOutputTokens?: number | null;
}

export interface FeatureFlags {
  demoMode: boolean;
  decisionLoggingEnabled: boolean;
  enableUnsafeScreening: boolean;
  enableOutputGuardrails: boolean;
  forceAbstainOnLowConfidence: boolean;
  inferenceModelOverride: string | null;
  fetchTimeoutMsOverride: number | null;
  maxFetchSizeMbOverride: number | null;
  maxOutputTokensOverride: number | null;
  forceUnsafeRejection: boolean;
  forceInferenceFailure: boolean;
}
