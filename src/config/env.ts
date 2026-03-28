import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const EnvSchema = z.object({
  PORT: z.coerce.number().int().positive().default(3000),
  OPENAI_API_KEY: z.string().min(1),
  OPENAI_MODEL: z.string().min(1).default("gpt-5.4-mini"),
  OPENAI_MODERATION_MODEL: z.string().min(1).default("omni-moderation-latest"),
  LOG_LEVEL: z.string().min(1).default("info"),
  IMAGE_FETCH_REDIRECT_LIMIT: z.coerce.number().int().min(0).default(3),
  IMAGE_FETCH_MAX_CONTENT_LENGTH_BYTES: z.coerce.number().int().positive().default(10 * 1024 * 1024),
  IMAGE_FETCH_CONNECT_TIMEOUT_MS: z.coerce.number().int().positive().default(2_000),
  IMAGE_FETCH_READ_TIMEOUT_MS: z.coerce.number().int().positive().default(5_000),
});

const env = EnvSchema.parse(process.env);

export { env };
