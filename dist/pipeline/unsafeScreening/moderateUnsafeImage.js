"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.moderateUnsafeImage = moderateUnsafeImage;
async function moderateUnsafeImage(openAIClient, metadata, requestId) {
    return openAIClient.screenUnsafeImage(metadata.finalUrl, requestId);
}
