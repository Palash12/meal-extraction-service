"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DetectedItemSchema = exports.NutritionRangeSchema = exports.ConfidenceLevelSchema = void 0;
const zod_1 = require("zod");
exports.ConfidenceLevelSchema = zod_1.z.enum(["low", "medium", "high"]);
exports.NutritionRangeSchema = zod_1.z
    .object({
    lower: zod_1.z.number().nonnegative(),
    upper: zod_1.z.number().nonnegative(),
})
    .strict();
exports.DetectedItemSchema = zod_1.z
    .object({
    name: zod_1.z.string().trim().min(1),
    evidence: zod_1.z.enum(["visible", "inferred"]),
    confidence: exports.ConfidenceLevelSchema,
})
    .strict();
