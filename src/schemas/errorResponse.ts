import { z } from "zod";

const ErrorCodeSchema = z.enum([
  "VALIDATION_ERROR",
  "INPUT_REJECTED",
  "FETCH_FAILED",
  "FETCH_TIMEOUT",
  "UPSTREAM_INFERENCE_FAILURE",
  "UPSTREAM_TIMEOUT",
  "POLICY_BLOCKED",
  "INTERNAL_SERVER_ERROR",
  "NOT_FOUND",
]);

export const ErrorResponseSchema = z
  .object({
    requestId: z.string().trim().min(1),
    error: z
      .object({
        code: ErrorCodeSchema,
        message: z.string().trim().min(1),
        retryable: z.boolean(),
      })
      .strict(),
  })
  .strict();

export type ErrorResponseOutput = z.infer<typeof ErrorResponseSchema>;
