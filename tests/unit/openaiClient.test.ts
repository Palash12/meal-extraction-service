import { AppError } from "../../src/lib/errors";
import { OpenAIClient } from "../../src/clients/openaiClient";

describe("OpenAIClient", () => {
  const metrics = {
    increment: jest.fn(),
    histogram: jest.fn(),
  };

  const tracer = {
    startSpan: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns a narrow unsafe-screening rejection when moderation flags the image", async () => {
    const openai = {
      moderations: {
        create: jest.fn().mockResolvedValue({
          results: [{ flagged: true }],
        }),
      },
      responses: {
        create: jest.fn(),
      },
    };

    const client = new OpenAIClient(
      openai as never,
      {
        inferenceModel: "gpt-5.4-mini",
        moderationModel: "omni-moderation-latest",
        maxOutputTokens: 300,
      },
      { metrics, tracer },
    );

    await expect(
      client.screenUnsafeImage("https://example.com/unsafe.jpg"),
    ).resolves.toEqual({
      allowed: false,
      reasonCode: "UNSAFE_IMAGE",
      policyFlags: ["UNSAFE_IMAGE"],
    });

    expect(tracer.startSpan).toHaveBeenCalledWith(
      "unsafe_screening",
      expect.objectContaining({ model_name: "omni-moderation-latest" }),
    );
  });

  it("can force an unsafe rejection in local demo mode without calling moderation", async () => {
    const openai = {
      moderations: {
        create: jest.fn(),
      },
      responses: {
        create: jest.fn(),
      },
    };

    const client = new OpenAIClient(
      openai as never,
      {
        inferenceModel: "gpt-5.4-mini",
        moderationModel: "omni-moderation-latest",
      },
      {
        metrics,
        tracer,
        featureFlags: {
          demoMode: true,
          decisionLoggingEnabled: true,
          enableUnsafeScreening: true,
          enableOutputGuardrails: true,
          forceAbstainOnLowConfidence: true,
          inferenceModelOverride: null,
          fetchTimeoutMsOverride: null,
          maxFetchSizeMbOverride: null,
          maxOutputTokensOverride: null,
          forceUnsafeRejection: true,
          forceInferenceFailure: false,
        },
      },
    );

    await expect(
      client.screenUnsafeImage("https://example.com/unsafe.jpg", "req_force_unsafe"),
    ).resolves.toEqual({
      allowed: false,
      reasonCode: "UNSAFE_IMAGE",
      policyFlags: ["UNSAFE_IMAGE"],
    });

    expect(openai.moderations.create).not.toHaveBeenCalled();
  });

  it("normalizes structured meal inference output", async () => {
    const openai = {
      moderations: {
        create: jest.fn(),
      },
      responses: {
        create: jest.fn().mockResolvedValue({
          output_text: JSON.stringify({
            mealDetected: true,
            unsafeOrDisallowedDetected: false,
            imageUsable: true,
            confidence: "medium",
            detectedItems: [
              {
                name: "rice",
                evidence: "visible",
                confidence: "high",
                portionEstimate: 180,
                portionUnit: "g",
                reasoningNote: "A mound of rice is clearly visible on the plate.",
              },
              {
                name: "sauce",
                evidence: "inferred",
                confidence: "low",
                portionEstimate: 1,
                portionUnit: "serving",
                reasoningNote: "A sauce may be present based on the plated sheen.",
              },
            ],
            uncertaintyNotes: ["Sauce quantity is unclear."],
            clarifyingQuestion: "Was there dressing on the side?",
            abstainRecommended: false,
          }),
          usage: {
            input_tokens: 100,
            output_tokens: 50,
          },
        }),
      },
    };

    const client = new OpenAIClient(
      openai as never,
      {
        inferenceModel: "gpt-5.4-mini",
        moderationModel: "omni-moderation-latest",
        maxOutputTokens: 300,
      },
      { metrics, tracer },
    );

    await expect(
      client.inferMeal({
        image_url: "https://example.com/meal.jpg",
        request_id: "req_1",
        user_note: "Looks like rice and chicken",
      }),
    ).resolves.toMatchObject({
      mealDetected: true,
      unsafeOrDisallowedDetected: false,
      imageUsable: true,
      confidence: "medium",
      detectedItems: [
        expect.objectContaining({
          name: "rice",
          evidence: "visible",
          confidence: "high",
          portionEstimate: 180,
          portionUnit: "g",
        }),
        expect.objectContaining({
          name: "sauce",
          evidence: "inferred",
          confidence: "low",
          portionEstimate: 1,
          portionUnit: "serving",
        }),
      ],
      clarifyingQuestion: "Was there dressing on the side?",
    });

    expect(tracer.startSpan).toHaveBeenCalledWith(
      "meal_inference",
      expect.objectContaining({
        request_id: "req_1",
        model_name: "gpt-5.4-mini",
      }),
    );
    expect(metrics.increment).toHaveBeenCalledWith("model_calls_total");
    expect(metrics.increment).toHaveBeenCalledWith(
      "model_input_tokens_total",
      100,
    );
    expect(metrics.increment).toHaveBeenCalledWith(
      "model_output_tokens_total",
      50,
    );
    expect(openai.responses.create).toHaveBeenCalledWith(
      expect.objectContaining({
        max_output_tokens: 300,
      }),
    );
  });

  it("maps inference failures to a stable upstream error", async () => {
    const openai = {
      moderations: {
        create: jest.fn(),
      },
      responses: {
        create: jest.fn().mockRejectedValue(new Error("boom")),
      },
    };

    const client = new OpenAIClient(
      openai as never,
      {
        inferenceModel: "gpt-5.4-mini",
        moderationModel: "omni-moderation-latest",
      },
      { metrics, tracer },
    );

    await expect(
      client.inferMeal({
        image_url: "https://example.com/meal.jpg",
        request_id: "req_2",
      }),
    ).rejects.toEqual(
      new AppError(502, "UPSTREAM_INFERENCE_FAILURE", "Meal inference failed"),
    );
  });

  it("can force an inference failure in local demo mode", async () => {
    const openai = {
      moderations: {
        create: jest.fn(),
      },
      responses: {
        create: jest.fn(),
      },
    };

    const client = new OpenAIClient(
      openai as never,
      {
        inferenceModel: "gpt-5.4-mini",
        moderationModel: "omni-moderation-latest",
      },
      {
        metrics,
        tracer,
        featureFlags: {
          demoMode: true,
          decisionLoggingEnabled: true,
          enableUnsafeScreening: true,
          enableOutputGuardrails: true,
          forceAbstainOnLowConfidence: true,
          inferenceModelOverride: null,
          fetchTimeoutMsOverride: null,
          maxFetchSizeMbOverride: null,
          maxOutputTokensOverride: null,
          forceUnsafeRejection: false,
          forceInferenceFailure: true,
        },
      },
    );

    await expect(
      client.inferMeal({
        image_url: "https://example.com/meal.jpg",
        request_id: "req_force_failure",
      }),
    ).rejects.toEqual(
      new AppError(502, "UPSTREAM_INFERENCE_FAILURE", "Meal inference failed"),
    );

    expect(openai.responses.create).not.toHaveBeenCalled();
  });

  it("returns embeddings for lightweight nutrition fallback matching", async () => {
    const openai = {
      moderations: {
        create: jest.fn(),
      },
      embeddings: {
        create: jest.fn().mockResolvedValue({
          data: [{ embedding: [0.1, 0.2, 0.3] }],
        }),
      },
      responses: {
        create: jest.fn(),
      },
    };

    const client = new OpenAIClient(
      openai as never,
      {
        inferenceModel: "gpt-5.4-mini",
        moderationModel: "omni-moderation-latest",
      },
      { metrics, tracer },
    );

    await expect(client.embedTexts(["grilled chicken"])).resolves.toEqual([
      [0.1, 0.2, 0.3],
    ]);
  });
});
