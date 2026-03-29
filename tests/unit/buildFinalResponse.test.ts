import { buildFinalResponse } from "../../src/pipeline/outputGuardrails/buildFinalResponse";
import type { MealAnalysisRequest } from "../../src/types/api";
import type {
  MealInferenceResult,
  OutputGuardrailsResult,
} from "../../src/types/pipeline";

const request: MealAnalysisRequest = {
  image_url: "https://example.com/meal.jpg",
  request_id: "req_1",
};

const inference: MealInferenceResult = {
  confidence: "medium",
  detectedItems: [{ name: "rice", evidence: "visible", confidence: "high" }],
  nutritionEstimate: {
    calories: { lower: 350, upper: 450 },
    protein_g: { lower: 20, upper: 25 },
    carbs_g: { lower: 40, upper: 55 },
    fat_g: { lower: 8, upper: 14 },
  },
  uncertaintyNotes: ["Sauce quantity is unclear."],
  clarifyingQuestion: "Was there dressing on the side?",
  abstainRecommended: false,
  modelFlags: [],
  groundingMatches: [],
};

describe("buildFinalResponse", () => {
  it("returns the stable external response shape", () => {
    const output: OutputGuardrailsResult = {
      status: "ok",
      policyFlags: [],
      abstained: false,
      reason: null,
      clarifyingQuestion: "Was there dressing on the side?",
      changedOutcome: false,
    };

    expect(buildFinalResponse(request, inference, output)).toEqual({
      requestId: "req_1",
      status: "ok",
      confidence: "medium",
      detectedItems: [
        { name: "rice", evidence: "visible", confidence: "high" },
      ],
      nutritionEstimate: {
        calories: { lower: 350, upper: 450 },
        protein_g: { lower: 20, upper: 25 },
        carbs_g: { lower: 40, upper: 55 },
        fat_g: { lower: 8, upper: 14 },
      },
      uncertaintyNotes: ["Sauce quantity is unclear."],
      clarifyingQuestion: "Was there dressing on the side?",
      policyFlags: [],
      abstained: false,
      reason: null,
    });
  });

  it("removes clarifying questions when output is policy-blocked", () => {
    const output: OutputGuardrailsResult = {
      status: "abstained",
      policyFlags: ["MEDICAL_ADVICE_BLOCKED"],
      abstained: true,
      reason: "MEDICAL_ADVICE_BLOCKED",
      clarifyingQuestion: "Is this safe for your condition?",
      changedOutcome: true,
    };

    expect(
      buildFinalResponse(request, inference, output).clarifyingQuestion,
    ).toBeNull();
  });
});
