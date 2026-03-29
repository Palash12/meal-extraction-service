import { z } from "zod";

export const FetchPolicyConfigSchema = z
  .object({
    allowedSchemes: z.array(z.enum(["https"])).min(1),
    redirectLimit: z.number().int().min(0),
    maxContentLengthBytes: z.number().int().positive(),
    connectionTimeoutMs: z.number().int().positive(),
    readTimeoutMs: z.number().int().positive(),
    allowedContentTypes: z
      .array(z.enum(["image/jpeg", "image/png", "image/webp"]))
      .min(1),
  })
  .strict();

export const ModelConfigSchema = z
  .object({
    inferenceModel: z.string().trim().min(1),
    moderationModel: z.string().trim().min(1),
    mealInferencePromptVersion: z.string().trim().min(1),
    maxOutputTokens: z.number().int().positive().nullable().optional(),
  })
  .strict();

export const FeatureFlagsSchema = z
  .object({
    demoMode: z.boolean(),
    decisionLoggingEnabled: z.boolean(),
    enableUnsafeScreening: z.boolean(),
    enableOutputGuardrails: z.boolean(),
    forceAbstainOnLowConfidence: z.boolean(),
    inferenceModelOverride: z.string().trim().min(1).nullable(),
    fetchTimeoutMsOverride: z.number().int().positive().nullable(),
    maxFetchSizeMbOverride: z.number().positive().nullable(),
    maxOutputTokensOverride: z.number().int().positive().nullable(),
    forceUnsafeRejection: z.boolean(),
    forceInferenceFailure: z.boolean(),
  })
  .strict();

export type FetchPolicyConfigInput = z.infer<typeof FetchPolicyConfigSchema>;
export type ModelConfigInput = z.infer<typeof ModelConfigSchema>;
export type FeatureFlagsInput = z.infer<typeof FeatureFlagsSchema>;
