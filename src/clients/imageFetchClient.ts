import { env } from "../config/env";
import { AppError } from "../lib/errors";
import { assertSafeImageUrl } from "../lib/urlSafety";
import type { DemoObservability } from "../services/observability/demoObservability";
import { noOpMetrics } from "../services/observability/metrics";
import { noOpTracer } from "../services/observability/tracer";
import type { AllowedImageContentType, FetchPolicyConfig } from "../types/config";
import type { ImageFetchMetadata } from "../types/pipeline";

const DEFAULT_FETCH_POLICY: FetchPolicyConfig = {
  allowedSchemes: ["https"],
  redirectLimit: env.IMAGE_FETCH_REDIRECT_LIMIT,
  maxContentLengthBytes: env.IMAGE_FETCH_MAX_CONTENT_LENGTH_BYTES,
  connectionTimeoutMs: env.IMAGE_FETCH_CONNECT_TIMEOUT_MS,
  readTimeoutMs: env.IMAGE_FETCH_READ_TIMEOUT_MS,
  allowedContentTypes: ["image/jpeg", "image/png", "image/webp"],
};

function parseContentType(contentTypeHeader: string | null): AllowedImageContentType | null {
  if (!contentTypeHeader) {
    return null;
  }

  const parsed = contentTypeHeader.split(";")[0]?.trim().toLowerCase();

  if (parsed === "image/jpeg" || parsed === "image/png" || parsed === "image/webp") {
    return parsed;
  }

  return null;
}

function getContentLength(headerValue: string | null): number | null {
  if (!headerValue) {
    return null;
  }

  const parsed = Number(headerValue);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function createTimeoutSignal(timeoutMs: number): AbortSignal {
  return AbortSignal.timeout(timeoutMs);
}

async function readWithTimeout(response: Response, timeoutMs: number): Promise<Uint8Array> {
  const readPromise = response.arrayBuffer().then((buffer) => new Uint8Array(buffer));
  const timeoutPromise = new Promise<never>((_, reject) => {
    const timer = setTimeout(() => {
      reject(new AppError(408, "FETCH_TIMEOUT", "Image fetch read timed out"));
    }, timeoutMs);

    readPromise.finally(() => clearTimeout(timer)).catch(() => undefined);
  });

  return Promise.race([readPromise, timeoutPromise]);
}

export class ImageFetchClient {
  readonly policy: FetchPolicyConfig;
  private readonly demoObservability?: DemoObservability;

  constructor(policy: FetchPolicyConfig = DEFAULT_FETCH_POLICY, demoObservability?: DemoObservability) {
    this.policy = policy;
    this.demoObservability = demoObservability;
  }

  async fetchMetadata(imageUrl: string, requestId = "unknown"): Promise<ImageFetchMetadata> {
    const startedAt = Date.now();
    noOpTracer.startSpan("image_fetch", {
      request_id: requestId,
      stage: "image_fetch",
    });

    const normalizedUrl = assertSafeImageUrl(imageUrl).toString();

    try {
      const metadata = await this.fetchWithRedirects(normalizedUrl, 0);
      const latencyMs = Date.now() - startedAt;
      noOpMetrics.histogram("stage_latency_ms", latencyMs);
      this.demoObservability?.recordStageDecision({
        requestId,
        stage: "image_fetch",
        outcome: "accepted",
        latencyMs,
        details: {
          redirect_count: metadata.redirectCount,
          bytes_sampled: metadata.bytesSampled,
          content_length: metadata.contentLength ?? 0,
        },
      });
      return metadata;
    } catch (error) {
      this.demoObservability?.recordStageDecision({
        requestId,
        stage: "image_fetch",
        outcome: "error",
        reasonCode: error instanceof AppError ? error.code : "FETCH_FAILED",
        latencyMs: Date.now() - startedAt,
      });
      if (error instanceof AppError) {
        throw error;
      }

      throw new AppError(502, "FETCH_FAILED", "Image fetch failed");
    }
  }

  private async fetchWithRedirects(imageUrl: string, redirectCount: number): Promise<ImageFetchMetadata> {
    if (redirectCount > this.policy.redirectLimit) {
      throw new AppError(400, "INPUT_REJECTED", "Image URL redirect limit exceeded");
    }

    let response: Response;

    try {
      response = await fetch(imageUrl, {
        method: "GET",
        redirect: "manual",
        signal: createTimeoutSignal(this.policy.connectionTimeoutMs),
      });
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }

      if (error instanceof Error && error.name === "TimeoutError") {
        noOpMetrics.increment("fetch_timeout_total");
        throw new AppError(408, "FETCH_TIMEOUT", "Image fetch connection timed out");
      }

      throw new AppError(502, "FETCH_FAILED", "Image fetch failed");
    }

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");

      if (!location) {
        throw new AppError(502, "FETCH_FAILED", "Redirect response did not include a location");
      }

      const nextUrl = new URL(location, imageUrl).toString();
      assertSafeImageUrl(nextUrl);
      return this.fetchWithRedirects(nextUrl, redirectCount + 1);
    }

    if (!response.ok) {
      throw new AppError(502, "FETCH_FAILED", `Image fetch returned status ${response.status}`);
    }

    const contentType = parseContentType(response.headers.get("content-type"));

    if (!contentType || !this.policy.allowedContentTypes.includes(contentType)) {
      throw new AppError(400, "INPUT_REJECTED", "Image content type is not allowed");
    }

    const contentLength = getContentLength(response.headers.get("content-length"));

    if (
      contentLength !== null &&
      contentLength > this.policy.maxContentLengthBytes
    ) {
      throw new AppError(400, "INPUT_REJECTED", "Image content length exceeds the maximum allowed size");
    }

    const body = await readWithTimeout(response, this.policy.readTimeoutMs);

    if (body.byteLength > this.policy.maxContentLengthBytes) {
      throw new AppError(400, "INPUT_REJECTED", "Image content length exceeds the maximum allowed size");
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
