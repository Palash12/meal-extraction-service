"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MealExtractionRequestSchema = void 0;
const zod_1 = require("zod");
exports.MealExtractionRequestSchema = zod_1.z
    .object({
    image_url: zod_1.z.string().url(),
    user_note: zod_1.z.string().trim().min(1).max(1000).optional(),
    request_id: zod_1.z.string().trim().min(1).max(100).optional(),
})
    .strict();
