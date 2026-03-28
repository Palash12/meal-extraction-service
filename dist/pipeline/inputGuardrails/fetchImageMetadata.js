"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.fetchImageMetadata = fetchImageMetadata;
async function fetchImageMetadata(imageFetchClient, imageUrl, requestId) {
    return imageFetchClient.fetchMetadata(imageUrl, requestId);
}
