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
      },
      { metrics, tracer },
    );

    await expect(client.screenUnsafeImage("https://example.com/unsafe.jpg")).resolves.toEqual({
      allowed: false,
      reasonCode: "UNSAFE_IMAGE",
      policyFlags: ["UNSAFE_IMAGE"],
    });

    expect(tracer.startSpan).toHaveBeenCalledWith(
      "unsafe_screening",
      expect.objectContaining({ model_name: "omni-moderation-latest" }),
    );
  });

  it("normalizes structured meal inference output", async () => {
    const openai = {
      moderations: {
        create: jest.fn(),
      },
      responses: {
        create: jest.fn().mockResolvedValue({
          output_text: JSON.stringify({
            confidence: "medium",
            detectedItems: [
              { name: "rice", evidence: "visible", confidence: "high" },
              { name: "sauce", evidence: "inferred", confidence: "low" },
            ],
            nutritionEstimate: {
              calories: { lower: 400, upper: 550 },
              protein_g: { lower: 20, upper: 28 },
              carbs_g: { lower: 35, upper: 50 },
              fat_g: { lower: 12, upper: 20 },
            },
            uncertaintyNotes: ["Sauce quantity is unclear."],
            clarifyingQuestion: "Was there dressing on the side?",
            abstainRecommended: false,
            modelFlags: [],
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
      confidence: "medium",
      detectedItems: [
        { name: "rice", evidence: "visible", confidence: "high" },
        { name: "sauce", evidence: "inferred", confidence: "low" },
      ],
      clarifyingQuestion: "Was there dressing on the side?",
    });

    expect(tracer.startSpan).toHaveBeenCalledWith(
      "meal_inference",
      expect.objectContaining({ request_id: "req_1", model_name: "gpt-5.4-mini" }),
    );
    expect(metrics.increment).toHaveBeenCalledWith("model_calls_total");
    expect(metrics.increment).toHaveBeenCalledWith("model_input_tokens_total", 100);
    expect(metrics.increment).toHaveBeenCalledWith("model_output_tokens_total", 50);
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
});
