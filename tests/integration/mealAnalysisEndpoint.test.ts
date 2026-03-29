process.env.OPENAI_API_KEY = "test-key";

import request from "supertest";

import { createApp } from "../../src/app";
import { AppError } from "../../src/lib/errors";
import { MealAnalysisOrchestrator } from "../../src/pipeline/orchestrator/mealAnalysisOrchestrator";
import type { FeatureFlags } from "../../src/services/config/featureFlags";
import type { MealExtractionResult } from "../../src/types/pipeline";

function createImageMetadata(
  overrides: Partial<ReturnType<typeof baseImageMetadata>> = {},
) {
  return {
    ...baseImageMetadata(),
    ...overrides,
  };
}

function baseImageMetadata() {
  return {
    finalUrl: "https://example.com/meal.jpg",
    contentType: "image/jpeg" as const,
    contentLength: 2048,
    bytesSampled: 2048,
    redirectCount: 0,
    policy: {
      allowedSchemes: ["https"] as const,
      redirectLimit: 3,
      maxContentLengthBytes: 5_000_000,
      connectionTimeoutMs: 1_000,
      readTimeoutMs: 1_000,
      allowedContentTypes: ["image/jpeg", "image/png", "image/webp"] as const,
    },
  };
}

function createInferenceResult(
  overrides: Partial<MealExtractionResult> = {},
): MealExtractionResult {
  return {
    mealDetected: true,
    unsafeOrDisallowedDetected: false,
    imageUsable: true,
    confidence: "medium",
    detectedItems: [
      {
        name: "rice",
        evidence: "visible",
        confidence: "high",
        portionEstimate: 200,
        portionUnit: "g",
        reasoningNote: "A mound of white rice is clearly visible.",
      },
    ],
    uncertaintyNotes: ["Portion size is estimated from a single image."],
    clarifyingQuestion: null,
    abstainRecommended: false,
    modelFlags: [],
    ...overrides,
  };
}

function createTestApp(options: {
  fetchMetadata?: jest.Mock;
  screenUnsafeImage?: jest.Mock;
  inferMeal?: jest.Mock;
  featureFlags?: Partial<FeatureFlags>;
}) {
  const imageFetchClient = {
    fetchMetadata:
      options.fetchMetadata ??
      jest.fn().mockResolvedValue(createImageMetadata()),
  };
  const openAIClient = {
    getInferenceModel: jest.fn().mockReturnValue("gpt-test-inference"),
    getModerationModel: jest.fn().mockReturnValue("omni-moderation-test"),
    embedTexts: jest.fn(),
    screenUnsafeImage:
      options.screenUnsafeImage ??
      jest.fn().mockResolvedValue({
        allowed: true,
        reasonCode: null,
        policyFlags: [],
      }),
    inferMeal:
      options.inferMeal ?? jest.fn().mockResolvedValue(createInferenceResult()),
  };

  const orchestrator = new MealAnalysisOrchestrator({
    imageFetchClient: imageFetchClient as never,
    openAIClient: openAIClient as never,
    featureFlags: {
      demoMode: false,
      decisionLoggingEnabled: false,
      enableUnsafeScreening: true,
      enableOutputGuardrails: true,
      forceAbstainOnLowConfidence: true,
      inferenceModelOverride: null,
      fetchTimeoutMsOverride: null,
      maxFetchSizeMbOverride: null,
      maxOutputTokensOverride: null,
      forceUnsafeRejection: false,
      forceInferenceFailure: false,
      ...options.featureFlags,
    },
  });

  return {
    app: createApp({ mealAnalysisOrchestrator: orchestrator }),
    imageFetchClient,
    openAIClient,
  };
}

describe("POST /v1/meals/analyze", () => {
  it("returns a successful analysis with a generated request id", async () => {
    const { app, imageFetchClient, openAIClient } = createTestApp({});

    const response = await request(app).post("/v1/meals/analyze").send({
      image_url: "https://example.com/meal.jpg",
      user_note: "Lunch",
    });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      requestId: response.headers["x-request-id"],
      status: "ok",
      confidence: "medium",
      detectedItems: [
        { name: "rice", evidence: "visible", confidence: "high" },
      ],
      nutritionEstimate: {
        calories: { lower: 208, upper: 312 },
        protein_g: { lower: 3.8, upper: 5.8 },
        carbs_g: { lower: 45.1, upper: 67.7 },
        fat_g: { lower: 0.5, upper: 0.7 },
      },
      uncertaintyNotes: ["Portion size is estimated from a single image."],
      clarifyingQuestion: null,
      policyFlags: [],
      abstained: false,
      reason: null,
    });
    expect(response.body).not.toHaveProperty("total_latency_ms");
    expect(response.body).not.toHaveProperty("trace");
    expect(typeof response.headers["x-request-id"]).toBe("string");
    expect(imageFetchClient.fetchMetadata).toHaveBeenCalledTimes(1);
    expect(openAIClient.screenUnsafeImage).toHaveBeenCalledTimes(1);
    expect(openAIClient.inferMeal).toHaveBeenCalledTimes(1);
  });

  it("short-circuits rejected inputs before moderation and inference", async () => {
    const { app, openAIClient } = createTestApp({
      fetchMetadata: jest.fn().mockResolvedValue(
        createImageMetadata({
          contentType: "text/plain" as never,
        }),
      ),
    });

    const response = await request(app).post("/v1/meals/analyze").send({
      image_url: "https://example.com/not-an-image",
      request_id: "req_rejected",
    });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      requestId: "req_rejected",
      error: {
        code: "INPUT_REJECTED",
        message: "Image content type is not usable",
        retryable: false,
      },
    });
    expect(openAIClient.screenUnsafeImage).not.toHaveBeenCalled();
    expect(openAIClient.inferMeal).not.toHaveBeenCalled();
  });

  it("returns an unsafe-content rejection when moderation blocks the image", async () => {
    const { app, openAIClient } = createTestApp({
      screenUnsafeImage: jest.fn().mockResolvedValue({
        allowed: false,
        reasonCode: "UNSAFE_IMAGE",
        policyFlags: ["UNSAFE_IMAGE"],
      }),
    });

    const response = await request(app).post("/v1/meals/analyze").send({
      image_url: "https://example.com/unsafe-meal.jpg",
      request_id: "req_unsafe",
    });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      requestId: "req_unsafe",
      error: {
        code: "INPUT_REJECTED",
        message: "Image contains unsafe or disallowed content",
        retryable: false,
      },
    });
    expect(openAIClient.inferMeal).not.toHaveBeenCalled();
  });

  it("returns an abstained analysis when output guardrails downgrade a low-confidence result", async () => {
    const { app } = createTestApp({
      inferMeal: jest.fn().mockResolvedValue(
        createInferenceResult({
          mealDetected: false,
          confidence: "low",
          detectedItems: [],
          uncertaintyNotes: ["The meal is partially obscured."],
          clarifyingQuestion:
            "Was there an additional side dish outside the frame?",
          abstainRecommended: true,
          modelFlags: ["LOW_CONFIDENCE"],
        }),
      ),
    });

    const response = await request(app).post("/v1/meals/analyze").send({
      image_url: "https://example.com/unclear-meal.jpg",
      request_id: "req_abstain",
    });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      requestId: "req_abstain",
      status: "abstained",
      confidence: "low",
      detectedItems: [],
      nutritionEstimate: null,
      uncertaintyNotes: [
        "The meal is partially obscured.",
        "No clear meal was detected for trusted nutrition grounding.",
      ],
      clarifyingQuestion:
        "Was there an additional side dish outside the frame?",
      policyFlags: ["LOW_CONFIDENCE"],
      abstained: true,
      reason: "LOW_CONFIDENCE",
    });
  });

  it("returns a stable upstream failure error", async () => {
    const { app } = createTestApp({
      inferMeal: jest
        .fn()
        .mockRejectedValue(
          new AppError(
            502,
            "UPSTREAM_INFERENCE_FAILURE",
            "Meal inference failed",
          ),
        ),
    });

    const response = await request(app).post("/v1/meals/analyze").send({
      image_url: "https://example.com/meal.jpg",
      request_id: "req_upstream",
    });

    expect(response.status).toBe(502);
    expect(response.body).toEqual({
      requestId: "req_upstream",
      error: {
        code: "UPSTREAM_INFERENCE_FAILURE",
        message: "Meal inference failed",
        retryable: true,
      },
    });
  });
});
