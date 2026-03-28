"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ImageFetchClient = void 0;
const env_1 = require("../config/env");
const errors_1 = require("../lib/errors");
const urlSafety_1 = require("../lib/urlSafety");
const metrics_1 = require("../services/observability/metrics");
const tracer_1 = require("../services/observability/tracer");
const DEFAULT_FETCH_POLICY = {
    allowedSchemes: ["https"],
    redirectLimit: env_1.env.IMAGE_FETCH_REDIRECT_LIMIT,
    maxContentLengthBytes: env_1.env.IMAGE_FETCH_MAX_CONTENT_LENGTH_BYTES,
    connectionTimeoutMs: env_1.env.IMAGE_FETCH_CONNECT_TIMEOUT_MS,
    readTimeoutMs: env_1.env.IMAGE_FETCH_READ_TIMEOUT_MS,
    allowedContentTypes: ["image/jpeg", "image/png", "image/webp"],
};
function parseContentType(contentTypeHeader) {
    if (!contentTypeHeader) {
        return null;
    }
    const parsed = contentTypeHeader.split(";")[0]?.trim().toLowerCase();
    if (parsed === "image/jpeg" || parsed === "image/png" || parsed === "image/webp") {
        return parsed;
    }
    return null;
}
function getContentLength(headerValue) {
    if (!headerValue) {
        return null;
    }
    const parsed = Number(headerValue);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}
function createTimeoutSignal(timeoutMs) {
    return AbortSignal.timeout(timeoutMs);
}
async function readWithTimeout(response, timeoutMs) {
    const readPromise = response.arrayBuffer().then((buffer) => new Uint8Array(buffer));
    const timeoutPromise = new Promise((_, reject) => {
        const timer = setTimeout(() => {
            reject(new errors_1.AppError(408, "FETCH_TIMEOUT", "Image fetch read timed out"));
        }, timeoutMs);
        readPromise.finally(() => clearTimeout(timer)).catch(() => undefined);
    });
    return Promise.race([readPromise, timeoutPromise]);
}
class ImageFetchClient {
    policy;
    constructor(policy = DEFAULT_FETCH_POLICY) {
        this.policy = policy;
    }
    async fetchMetadata(imageUrl, requestId = "unknown") {
        tracer_1.noOpTracer.startSpan("image_fetch", {
            request_id: requestId,
            stage: "image_fetch",
        });
        const normalizedUrl = (0, urlSafety_1.assertSafeImageUrl)(imageUrl).toString();
        try {
            const metadata = await this.fetchWithRedirects(normalizedUrl, 0);
            metrics_1.noOpMetrics.histogram("stage_latency_ms", 0);
            return metadata;
        }
        catch (error) {
            if (error instanceof errors_1.AppError) {
                throw error;
            }
            throw new errors_1.AppError(502, "FETCH_FAILED", "Image fetch failed");
        }
    }
    async fetchWithRedirects(imageUrl, redirectCount) {
        if (redirectCount > this.policy.redirectLimit) {
            throw new errors_1.AppError(400, "INPUT_REJECTED", "Image URL redirect limit exceeded");
        }
        let response;
        try {
            response = await fetch(imageUrl, {
                method: "GET",
                redirect: "manual",
                signal: createTimeoutSignal(this.policy.connectionTimeoutMs),
            });
        }
        catch (error) {
            if (error instanceof errors_1.AppError) {
                throw error;
            }
            if (error instanceof Error && error.name === "TimeoutError") {
                metrics_1.noOpMetrics.increment("fetch_timeout_total");
                throw new errors_1.AppError(408, "FETCH_TIMEOUT", "Image fetch connection timed out");
            }
            throw new errors_1.AppError(502, "FETCH_FAILED", "Image fetch failed");
        }
        if (response.status >= 300 && response.status < 400) {
            const location = response.headers.get("location");
            if (!location) {
                throw new errors_1.AppError(502, "FETCH_FAILED", "Redirect response did not include a location");
            }
            const nextUrl = new URL(location, imageUrl).toString();
            (0, urlSafety_1.assertSafeImageUrl)(nextUrl);
            return this.fetchWithRedirects(nextUrl, redirectCount + 1);
        }
        if (!response.ok) {
            throw new errors_1.AppError(502, "FETCH_FAILED", `Image fetch returned status ${response.status}`);
        }
        const contentType = parseContentType(response.headers.get("content-type"));
        if (!contentType || !this.policy.allowedContentTypes.includes(contentType)) {
            throw new errors_1.AppError(400, "INPUT_REJECTED", "Image content type is not allowed");
        }
        const contentLength = getContentLength(response.headers.get("content-length"));
        if (contentLength !== null &&
            contentLength > this.policy.maxContentLengthBytes) {
            throw new errors_1.AppError(400, "INPUT_REJECTED", "Image content length exceeds the maximum allowed size");
        }
        const body = await readWithTimeout(response, this.policy.readTimeoutMs);
        if (body.byteLength > this.policy.maxContentLengthBytes) {
            throw new errors_1.AppError(400, "INPUT_REJECTED", "Image content length exceeds the maximum allowed size");
        }
        return {
            finalUrl: response.url || imageUrl,
            contentType,
            contentLength: contentLength ?? body.byteLength,
            bytesSampled: body.byteLength,
            redirectCount,
            policy: this.policy,
        };
    }
}
exports.ImageFetchClient = ImageFetchClient;
