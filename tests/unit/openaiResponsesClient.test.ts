import { AppError } from "../../src/lib/errors";
import { OpenAIResponsesClient } from "../../src/clients/openaiResponsesClient";

describe("OpenAIResponsesClient", () => {
  it("builds a structured OpenAI request and parses the JSON response", async () => {
    const create = jest.fn().mockResolvedValue({
      output_text: JSON.stringify({
        dish_candidates: ["sushi"],
        visible_components: ["rice", "salmon"],
        portion_estimate: {
          size: "small",
          confidence: "high",
          notes: "Small plated serving",
        },
        observed: ["Salmon slices are visible"],
        assumed: [],
        unknown: [],
        needs_user_confirmation: false,
        clarifying_question: null,
      }),
    });

    const client = new OpenAIResponsesClient({ create }, "gpt-5.4-mini");

    const result = await client.extractMeal({
      image_url: "https://example.com/meal.jpg",
      user_note: "Looks like salmon nigiri",
      request_id: "req_1",
    });

    expect(result.dish_candidates).toEqual(["sushi"]);
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        model: "gpt-5.4-mini",
        store: false,
        text: expect.objectContaining({
          format: expect.objectContaining({
            type: "json_schema",
            name: "meal_extraction",
            strict: true,
          }),
        }),
      }),
    );
  });

  it("throws when OpenAI returns invalid JSON", async () => {
    const create = jest.fn().mockResolvedValue({
      output_text: "not json",
    });

    const client = new OpenAIResponsesClient({ create }, "gpt-5.4-mini");

    await expect(
      client.extractMeal({
        image_url: "https://example.com/meal.jpg",
      }),
    ).rejects.toMatchObject(
      new AppError(
        502,
        "UPSTREAM_INVALID_RESPONSE",
        "OpenAI returned invalid structured output",
        {
          cause: expect.any(String),
        },
      ),
    );
  });
});
