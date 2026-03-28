import { AppError } from "../../src/lib/errors";
import { MealExtractionService } from "../../src/services/mealExtractionService";
import type { MealExtractionOutput } from "../../src/schemas/mealExtraction";

const sampleResult: MealExtractionOutput = {
  dish_candidates: ["ramen"],
  visible_components: ["noodles", "broth"],
  portion_estimate: {
    size: "medium",
    confidence: "medium",
    notes: "Single bowl portion",
  },
  observed: ["Noodles are visible"],
  assumed: [],
  unknown: ["Protein type"],
  needs_user_confirmation: false,
  clarifying_question: null,
};

describe("MealExtractionService", () => {
  it("returns extracted meal data", async () => {
    const client = {
      extractMeal: jest.fn().mockResolvedValue(sampleResult),
    };

    const service = new MealExtractionService(client);

    await expect(
      service.extractMeal({
        image_url: "https://example.com/meal.jpg",
        request_id: "req_1",
      }),
    ).resolves.toEqual(sampleResult);
  });

  it("retries transient upstream failures", async () => {
    jest.useFakeTimers();

    const transientError = { name: "RateLimitError", status: 429 };
    const client = {
      extractMeal: jest
        .fn()
        .mockRejectedValueOnce(transientError)
        .mockResolvedValue(sampleResult),
    };

    const service = new MealExtractionService(client);

    const promise = service.extractMeal({
      image_url: "https://example.com/meal.jpg",
      request_id: "req_2",
    });

    await jest.advanceTimersByTimeAsync(250);
    await expect(promise).resolves.toEqual(sampleResult);
    expect(client.extractMeal).toHaveBeenCalledTimes(2);

    jest.useRealTimers();
  });

  it("wraps unknown failures in a stable upstream error", async () => {
    const client = {
      extractMeal: jest.fn().mockRejectedValue(new Error("boom")),
    };

    const service = new MealExtractionService(client);

    await expect(
      service.extractMeal({
        image_url: "https://example.com/meal.jpg",
        request_id: "req_3",
      }),
    ).rejects.toMatchObject(
      new AppError(502, "UPSTREAM_ERROR", "Meal extraction request failed", {
        request_id: "req_3",
      }),
    );
  });
});
