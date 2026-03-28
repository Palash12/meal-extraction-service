"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.assertSafeImageUrl = assertSafeImageUrl;
exports.normalizeImageUrl = normalizeImageUrl;
const errors_1 = require("./errors");
const ALLOWED_SCHEMES = new Set(["https:"]);
function assertSafeImageUrl(imageUrl) {
    let parsed;
    try {
        parsed = new URL(imageUrl);
    }
    catch {
        throw new errors_1.AppError(400, "INPUT_REJECTED", "Image URL is invalid");
    }
    if (!ALLOWED_SCHEMES.has(parsed.protocol)) {
        throw new errors_1.AppError(400, "INPUT_REJECTED", "Only https image URLs are allowed");
    }
    if (parsed.username || parsed.password) {
        throw new errors_1.AppError(400, "INPUT_REJECTED", "Image URL credentials are not allowed");
    }
    if (!parsed.hostname) {
        throw new errors_1.AppError(400, "INPUT_REJECTED", "Image URL hostname is required");
    }
    return parsed;
}
function normalizeImageUrl(imageUrl) {
    return assertSafeImageUrl(imageUrl).toString();
}
