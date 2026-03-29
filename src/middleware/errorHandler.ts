import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";

import { AppError } from "../lib/errors";
import { logger } from "../services/logging/logger";
import { demoObservability } from "../services/observability/demoObservability";
import { ErrorResponseSchema } from "../schemas/errorResponse";

export function notFoundHandler(request: Request, response: Response): void {
  const payload = {
    requestId: request.requestId ?? "unknown",
    error: {
      code: "NOT_FOUND",
      message: `Route not found: ${request.method} ${request.path}`,
      retryable: false,
    },
  };

  logger.requestCompleted({
    request_id: request.requestId ?? "unknown",
    http_status: 404,
    result_status: "error",
    total_latency_ms: Date.now() - (request.requestStartedAt ?? Date.now()),
    abstained: false,
    policy_flag_count: 0,
  });

  response.status(404).json(ErrorResponseSchema.parse(payload));
}

export function errorHandler(
  error: unknown,
  request: Request,
  response: Response,
  _next: NextFunction,
): void {
  if (error instanceof ZodError) {
    const payload = {
      requestId: request.requestId ?? "unknown",
      error: {
        code: "VALIDATION_ERROR",
        message: "Invalid request body",
        retryable: false,
      },
    };

    logger.inputRejected({
      request_id: request.requestId ?? "unknown",
      reason_code: "VALIDATION_ERROR",
      stage: "request_validation",
    });

    logger.requestCompleted({
      request_id: request.requestId ?? "unknown",
      http_status: 400,
      result_status: "error",
      total_latency_ms: Date.now() - (request.requestStartedAt ?? Date.now()),
      abstained: false,
      policy_flag_count: 0,
    });
    demoObservability.recordRequestOutcome({
      requestId: request.requestId ?? "unknown",
      outcome: "rejected",
      reasonCode: "VALIDATION_ERROR",
      latencyMs: Date.now() - (request.requestStartedAt ?? Date.now()),
    });

    response.status(400).json(ErrorResponseSchema.parse(payload));
    return;
  }

  if (error instanceof AppError) {
    const payload = {
      requestId: request.requestId ?? "unknown",
      error: {
        code: error.code,
        message: error.message,
        retryable: error.statusCode >= 500,
      },
    };

    const reasonCode =
      typeof error.details === "object" &&
      error.details !== null &&
      "reasonCode" in error.details &&
      typeof (error.details as { reasonCode?: unknown }).reasonCode === "string"
        ? (error.details as { reasonCode: string }).reasonCode
        : error.code;
    const stage =
      typeof error.details === "object" &&
      error.details !== null &&
      "stage" in error.details &&
      ((error.details as { stage?: unknown }).stage === "request_validation" ||
        (error.details as { stage?: unknown }).stage === "input_guardrails")
        ? (
            error.details as {
              stage: "request_validation" | "input_guardrails";
            }
          ).stage
        : "input_guardrails";

    if (error.code === "INPUT_REJECTED" && reasonCode !== "UNSAFE_IMAGE") {
      logger.inputRejected({
        request_id: request.requestId ?? "unknown",
        reason_code: reasonCode,
        stage,
      });
    }

    logger.requestCompleted({
      request_id: request.requestId ?? "unknown",
      http_status: error.statusCode,
      result_status: "error",
      total_latency_ms: Date.now() - (request.requestStartedAt ?? Date.now()),
      abstained: false,
      policy_flag_count:
        typeof error.details === "object" &&
        error.details !== null &&
        "policyFlags" in error.details &&
        Array.isArray((error.details as { policyFlags?: unknown }).policyFlags)
          ? (error.details as { policyFlags: unknown[] }).policyFlags.length
          : 0,
    });
    demoObservability.recordRequestOutcome({
      requestId: request.requestId ?? "unknown",
      outcome: error.code === "INPUT_REJECTED" ? "rejected" : "error",
      reasonCode,
      latencyMs: Date.now() - (request.requestStartedAt ?? Date.now()),
    });

    response.status(error.statusCode).json(ErrorResponseSchema.parse(payload));
    return;
  }

  logger.upstreamCallFailed({
    request_id: request.requestId ?? "unknown",
    upstream: "internal",
    error_code: "INTERNAL_SERVER_ERROR",
    retryable: false,
    attempt: 1,
  });

  logger.requestCompleted({
    request_id: request.requestId ?? "unknown",
    http_status: 500,
    result_status: "error",
    total_latency_ms: Date.now() - (request.requestStartedAt ?? Date.now()),
    abstained: false,
    policy_flag_count: 0,
  });
  demoObservability.recordRequestOutcome({
    requestId: request.requestId ?? "unknown",
    outcome: "error",
    reasonCode: "INTERNAL_SERVER_ERROR",
    latencyMs: Date.now() - (request.requestStartedAt ?? Date.now()),
  });

  response.status(500).json(
    ErrorResponseSchema.parse({
      requestId: request.requestId ?? "unknown",
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: "Unexpected server error",
        retryable: false,
      },
    }),
  );
}
