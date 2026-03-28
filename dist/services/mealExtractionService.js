"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MealExtractionService = void 0;
exports.isTransientOpenAIError = isTransientOpenAIError;
const errors_1 = require("../lib/errors");
const logger_1 = require("../lib/logger");
const retry_1 = require("../lib/retry");
const TRANSIENT_STATUS_CODES = new Set([408, 409, 429, 500, 502, 503, 504]);
const TRANSIENT_ERROR_NAMES = new Set([
    "APIConnectionError",
    "APIConnectionTimeoutError",
    "RateLimitError",
    "InternalServerError",
    "ConflictError",
]);
function getErrorStatus(error) {
    if (typeof error === "object" &&
        error !== null &&
        "status" in error &&
        typeof error.status === "number") {
        return error.status;
    }
    return undefined;
}
function getErrorName(error) {
    if (typeof error === "object" &&
        error !== null &&
        "name" in error &&
        typeof error.name === "string") {
        return error.name;
    }
    return undefined;
}
function isTransientOpenAIError(error) {
    const status = getErrorStatus(error);
    const name = getErrorName(error);
    return (status !== undefined && TRANSIENT_STATUS_CODES.has(status)) || (name !== undefined && TRANSIENT_ERROR_NAMES.has(name));
}
class MealExtractionService {
    openAIResponsesClient;
    constructor(openAIResponsesClient) {
        this.openAIResponsesClient = openAIResponsesClient;
    }
    async extractMeal(request) {
        try {
            return await (0, retry_1.retryWithBackoff)(() => this.openAIResponsesClient.extractMeal(request), {
                maxAttempts: 3,
                baseDelayMs: 250,
                maxDelayMs: 2_000,
                shouldRetry: isTransientOpenAIError,
                onRetry: (error, attempt, delayMs) => {
                    logger_1.logger.warn("retrying_openai_request", {
                        request_id: request.request_id,
                        attempt,
                        delay_ms: delayMs,
                        error_name: getErrorName(error),
                        status: getErrorStatus(error),
                    });
                },
            });
        }
        catch (error) {
            if (error instanceof errors_1.AppError) {
                throw error;
            }
            throw new errors_1.AppError(502, "UPSTREAM_ERROR", "Meal extraction request failed", {
                request_id: request.request_id,
            });
        }
    }
}
exports.MealExtractionService = MealExtractionService;
