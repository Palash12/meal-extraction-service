"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.assessImageUsability = assessImageUsability;
const MINIMUM_IMAGE_BYTES = 32;
const ALLOWED_CONTENT_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
function assessImageUsability(metadata) {
    if (!ALLOWED_CONTENT_TYPES.has(metadata.contentType)) {
        return {
            accepted: false,
            rejectionCode: "INPUT_REJECTED",
            rejectionReason: "Image content type is not usable",
            normalizedImageUrl: metadata.finalUrl,
            fetchedImage: metadata,
            policyFlags: ["UNUSABLE_IMAGE"],
        };
    }
    if (metadata.contentLength === 0 || metadata.bytesSampled < MINIMUM_IMAGE_BYTES) {
        return {
            accepted: false,
            rejectionCode: "INPUT_REJECTED",
            rejectionReason: "Image appears empty or unusable",
            normalizedImageUrl: metadata.finalUrl,
            fetchedImage: metadata,
            policyFlags: ["UNUSABLE_IMAGE"],
        };
    }
    return {
        accepted: true,
        rejectionCode: null,
        rejectionReason: null,
        normalizedImageUrl: metadata.finalUrl,
        fetchedImage: metadata,
        policyFlags: [],
    };
}
