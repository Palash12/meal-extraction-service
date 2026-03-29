import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const booleanFromEnv = z.preprocess((value) => {
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "true") {
      return true;
    }
    if (normalized === "false") {
      return false;
    }
  }

  return value;
}, z.boolean());

const EnvSchema = z.object({
  PORT: z.coerce.number().int().positive().default(3000),
  OPENAI_API_KEY: z.string().min(1),
  OPENAI_MODEL: z.string().min(1).default("gpt-5.4-mini"),
  OPENAI_MODERATION_MODEL: z.string().min(1).default("omni-moderation-latest"),
  LOG_LEVEL: z.string().min(1).default("info"),
  DEMO_MODE: booleanFromEnv.default(false),
  DECISION_LOGGING_ENABLED: booleanFromEnv.default(false),
  ENABLE_UNSAFE_SCREENING: booleanFromEnv.default(true),
  ENABLE_OUTPUT_GUARDRAILS: booleanFromEnv.default(true),
  FORCE_ABSTAIN_ON_LOW_CONFIDENCE: booleanFromEnv.default(true),
  INFERENCE_MODEL_OVERRIDE: z.string().trim().min(1).optional(),
  FETCH_TIMEOUT_MS: z.coerce.number().int().positive().optional(),
  MAX_FETCH_SIZE_MB: z.coerce.number().positive().optional(),
  MAX_OUTPUT_TOKENS: z.coerce.number().int().positive().optional(),
  DEMO_FORCE_UNSAFE_REJECTION: booleanFromEnv.default(false),
  DEMO_FORCE_INFERENCE_FAILURE: booleanFromEnv.default(false),
  IMAGE_FETCH_REDIRECT_LIMIT: z.coerce.number().int().min(0).default(3),
  IMAGE_FETCH_MAX_CONTENT_LENGTH_BYTES: z.coerce
    .number()
    .int()
    .positive()
    .default(10 * 1024 * 1024),
  IMAGE_FETCH_CONNECT_TIMEOUT_MS: z.coerce
    .number()
    .int()
    .positive()
    .default(2_000),
  IMAGE_FETCH_READ_TIMEOUT_MS: z.coerce
    .number()
    .int()
    .positive()
    .default(5_000),
});

const env = EnvSchema.parse(process.env);

export { env };
