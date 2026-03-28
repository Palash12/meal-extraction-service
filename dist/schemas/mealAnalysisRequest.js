"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MealAnalysisRequestSchema = void 0;
const zod_1 = require("zod");
exports.MealAnalysisRequestSchema = zod_1.z
    .object({
    image_url: zod_1.z.string().url(),
    user_note: zod_1.z.string().trim().min(1).max(1_000).optional(),
    request_id: zod_1.z.string().trim().min(1).max(100).optional(),
})
    .strict();
