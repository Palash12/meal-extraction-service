"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.notFoundHandler = notFoundHandler;
exports.errorHandler = errorHandler;
const zod_1 = require("zod");
const errors_1 = require("../lib/errors");
const logger_1 = require("../services/logging/logger");
const errorResponse_1 = require("../schemas/errorResponse");
function notFoundHandler(request, response) {
    const payload = {
        requestId: request.requestId ?? "unknown",
        error: {
            code: "NOT_FOUND",
            message: `Route not found: ${request.method} ${request.path}`,
            retryable: false,
        },
    };
    logger_1.logger.requestCompleted({
        request_id: request.requestId ?? "unknown",
        http_status: 404,
        result_status: "error",
        total_latency_ms: Date.now() - (request.requestStartedAt ?? Date.now()),
        abstained: false,
        policy_flag_count: 0,
    });
    response.status(404).json(errorResponse_1.ErrorResponseSchema.parse(payload));
}
function errorHandler(error, request, response, _next) {
    if (error instanceof zod_1.ZodError) {
        const payload = {
            requestId: request.requestId ?? "unknown",
            error: {
                code: "VALIDATION_ERROR",
                message: "Invalid request body",
                retryable: false,
            },
        };
        logger_1.logger.inputRejected({
            request_id: request.requestId ?? "unknown",
            reason_code: "VALIDATION_ERROR",
            stage: "request_validation",
        });
        logger_1.logger.requestCompleted({
            request_id: request.requestId ?? "unknown",
            http_status: 400,
            result_status: "error",
            total_latency_ms: Date.now() - (request.requestStartedAt ?? Date.now()),
            abstained: false,
            policy_flag_count: 0,
        });
        response.status(400).json(errorResponse_1.ErrorResponseSchema.parse(payload));
        return;
    }
    if (error instanceof errors_1.AppError) {
        const payload = {
            requestId: request.requestId ?? "unknown",
            error: {
                code: error.code,
                message: error.message,
                retryable: error.statusCode >= 500,
            },
        };
        const reasonCode = typeof error.details === "object" &&
            error.details !== null &&
            "reasonCode" in error.details &&
            typeof error.details.reasonCode === "string"
            ? error.details.reasonCode
            : error.code;
        const stage = typeof error.details === "object" &&
            error.details !== null &&
            "stage" in error.details &&
            (error.details.stage === "request_validation" ||
                error.details.stage === "input_guardrails")
            ? (error.details.stage)
            : "input_guardrails";
        if (error.code === "INPUT_REJECTED" && reasonCode !== "UNSAFE_IMAGE") {
            logger_1.logger.inputRejected({
                request_id: request.requestId ?? "unknown",
                reason_code: reasonCode,
                stage,
            });
        }
        logger_1.logger.requestCompleted({
            request_id: request.requestId ?? "unknown",
            http_status: error.statusCode,
            result_status: "error",
            total_latency_ms: Date.now() - (request.requestStartedAt ?? Date.now()),
            abstained: false,
            policy_flag_count: typeof error.details === "object" &&
                error.details !== null &&
                "policyFlags" in error.details &&
                Array.isArray(error.details.policyFlags)
                ? error.details.policyFlags.length
                : 0,
        });
        response.status(error.statusCode).json(errorResponse_1.ErrorResponseSchema.parse(payload));
        return;
    }
    logger_1.logger.upstreamCallFailed({
        request_id: request.requestId ?? "unknown",
        upstream: "internal",
        error_code: "INTERNAL_SERVER_ERROR",
        retryable: false,
        attempt: 1,
    });
    logger_1.logger.requestCompleted({
        request_id: request.requestId ?? "unknown",
        http_status: 500,
        result_status: "error",
        total_latency_ms: Date.now() - (request.requestStartedAt ?? Date.now()),
        abstained: false,
        policy_flag_count: 0,
    });
    response.status(500).json(errorResponse_1.ErrorResponseSchema.parse({
        requestId: request.requestId ?? "unknown",
        error: {
            code: "INTERNAL_SERVER_ERROR",
            message: "Unexpected server error",
            retryable: false,
        },
    }));
}
