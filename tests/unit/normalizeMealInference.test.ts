import { normalizeMealInference } from "../../src/pipeline/mealInference/normalizeMealInference";

describe("normalizeMealInference", () => {
  it("normalizes supported model flags and preserves stable fields", () => {
    expect(
      normalizeMealInference({
        mealDetected: true,
        unsafeOrDisallowedDetected: false,
        imageUsable: true,
        confidence: "low",
        detectedItems: [
          {
            name: "salad",
            evidence: "visible",
            confidence: "medium",
            portionEstimate: 1,
            portionUnit: "serving",
            reasoningNote: "Greens and vegetables are visible in the bowl.",
          },
        ],
        uncertaintyNotes: ["Portion size is unclear."],
        clarifyingQuestion: "Was there dressing added after the photo?",
        abstainRecommended: false,
      }),
    ).toEqual({
      mealDetected: true,
      unsafeOrDisallowedDetected: false,
      imageUsable: true,
      confidence: "low",
      detectedItems: [
        {
          name: "salad",
          evidence: "visible",
          confidence: "medium",
          portionEstimate: 1,
          portionUnit: "serving",
          reasoningNote: "Greens and vegetables are visible in the bowl.",
        },
      ],
      uncertaintyNotes: ["Portion size is unclear."],
      clarifyingQuestion: "Was there dressing added after the photo?",
      abstainRecommended: true,
      modelFlags: ["LOW_CONFIDENCE"],
    });
  });
});
