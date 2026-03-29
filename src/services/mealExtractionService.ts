import { AppError } from "../lib/errors";
import type { MealExtractionClient } from "../clients/openaiResponsesClient";
import { logger } from "../lib/logger";
import { retryWithBackoff } from "../lib/retry";
import type { MealExtractionOutput } from "../schemas/mealExtraction";
import type { MealExtractionRequest } from "../types/api";

const TRANSIENT_STATUS_CODES = new Set([408, 409, 429, 500, 502, 503, 504]);
const TRANSIENT_ERROR_NAMES = new Set([
  "APIConnectionError",
  "APIConnectionTimeoutError",
  "RateLimitError",
  "InternalServerError",
  "ConflictError",
]);

function getErrorStatus(error: unknown): number | undefined {
  if (
    typeof error === "object" &&
    error !== null &&
    "status" in error &&
    typeof (error as { status?: unknown }).status === "number"
  ) {
    return (error as { status: number }).status;
  }

  return undefined;
}

function getErrorName(error: unknown): string | undefined {
  if (
    typeof error === "object" &&
    error !== null &&
    "name" in error &&
    typeof (error as { name?: unknown }).name === "string"
  ) {
    return (error as { name: string }).name;
  }

  return undefined;
}

export function isTransientOpenAIError(error: unknown): boolean {
  const status = getErrorStatus(error);
  const name = getErrorName(error);
  return (
    (status !== undefined && TRANSIENT_STATUS_CODES.has(status)) ||
    (name !== undefined && TRANSIENT_ERROR_NAMES.has(name))
  );
}

export class MealExtractionService {
  constructor(private readonly openAIResponsesClient: MealExtractionClient) {}

  async extractMeal(
    request: MealExtractionRequest,
  ): Promise<MealExtractionOutput> {
    try {
      return await retryWithBackoff(
        () => this.openAIResponsesClient.extractMeal(request),
        {
          maxAttempts: 3,
          baseDelayMs: 250,
          maxDelayMs: 2_000,
          shouldRetry: isTransientOpenAIError,
          onRetry: (error, attempt, delayMs) => {
            logger.warn("retrying_openai_request", {
              request_id: request.request_id,
              attempt,
              delay_ms: delayMs,
              error_name: getErrorName(error),
              status: getErrorStatus(error),
            });
          },
        },
      );
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }

      throw new AppError(
        502,
        "UPSTREAM_ERROR",
        "Meal extraction request failed",
        {
          request_id: request.request_id,
        },
      );
    }
  }
}
