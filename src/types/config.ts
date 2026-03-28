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
}

export interface FeatureFlags {
  disableModerationScreening: boolean;
  disableInference: boolean;
  forceAbstain: boolean;
}
