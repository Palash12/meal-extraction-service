"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ErrorResponseSchema = void 0;
const zod_1 = require("zod");
const ErrorCodeSchema = zod_1.z.enum([
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
exports.ErrorResponseSchema = zod_1.z
    .object({
    requestId: zod_1.z.string().trim().min(1),
    error: zod_1.z
        .object({
        code: ErrorCodeSchema,
        message: zod_1.z.string().trim().min(1),
        retryable: zod_1.z.boolean(),
    })
        .strict(),
})
    .strict();
