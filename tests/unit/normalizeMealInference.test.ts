import { normalizeMealInference } from "../../src/pipeline/mealInference/normalizeMealInference";

describe("normalizeMealInference", () => {
  it("normalizes supported model flags and preserves stable fields", () => {
    expect(
      normalizeMealInference({
        confidence: "low",
        detectedItems: [{ name: "salad", evidence: "visible", confidence: "medium" }],
        nutritionEstimate: null,
        uncertaintyNotes: ["Portion size is unclear."],
        clarifyingQuestion: "Was there dressing added after the photo?",
        abstainRecommended: false,
        modelFlags: ["LOW_CONFIDENCE", "IGNORED_FLAG"],
      }),
    ).toEqual({
      confidence: "low",
      detectedItems: [{ name: "salad", evidence: "visible", confidence: "medium" }],
      nutritionEstimate: null,
      uncertaintyNotes: ["Portion size is unclear."],
      clarifyingQuestion: "Was there dressing added after the photo?",
      abstainRecommended: true,
      modelFlags: ["LOW_CONFIDENCE"],
    });
  });
});
