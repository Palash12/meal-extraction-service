"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FeatureFlagsSchema = exports.ModelConfigSchema = exports.FetchPolicyConfigSchema = void 0;
const zod_1 = require("zod");
exports.FetchPolicyConfigSchema = zod_1.z
    .object({
    allowedSchemes: zod_1.z.array(zod_1.z.enum(["https"])).min(1),
    redirectLimit: zod_1.z.number().int().min(0),
    maxContentLengthBytes: zod_1.z.number().int().positive(),
    connectionTimeoutMs: zod_1.z.number().int().positive(),
    readTimeoutMs: zod_1.z.number().int().positive(),
    allowedContentTypes: zod_1.z.array(zod_1.z.enum(["image/jpeg", "image/png", "image/webp"])).min(1),
})
    .strict();
exports.ModelConfigSchema = zod_1.z
    .object({
    inferenceModel: zod_1.z.string().trim().min(1),
    moderationModel: zod_1.z.string().trim().min(1),
    mealInferencePromptVersion: zod_1.z.string().trim().min(1),
})
    .strict();
exports.FeatureFlagsSchema = zod_1.z
    .object({
    disableModerationScreening: zod_1.z.boolean(),
    disableInference: zod_1.z.boolean(),
    forceAbstain: zod_1.z.boolean(),
})
    .strict();
