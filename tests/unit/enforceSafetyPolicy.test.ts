import { enforceSafetyPolicy } from "../../src/pipeline/outputGuardrails/enforceSafetyPolicy";
import type { MealInferenceResult } from "../../src/types/pipeline";

const metrics = {
  increment: jest.fn(),
  histogram: jest.fn(),
};

const tracer = {
  startSpan: jest.fn(),
};

const baseInference: MealInferenceResult = {
  confidence: "medium",
  detectedItems: [{ name: "rice", evidence: "visible", confidence: "high" }],
  nutritionEstimate: {
    calories: { lower: 400, upper: 500 },
    protein_g: { lower: 20, upper: 25 },
    carbs_g: { lower: 40, upper: 55 },
    fat_g: { lower: 10, upper: 18 },
  },
  uncertaintyNotes: [],
  clarifyingQuestion: null,
  abstainRecommended: false,
  modelFlags: [],
};

describe("enforceSafetyPolicy", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns ok when no guardrail changes are needed", () => {
    expect(
      enforceSafetyPolicy(baseInference, "req_ok", { metrics, tracer }),
    ).toEqual({
      status: "ok",
      policyFlags: [],
      abstained: false,
      reason: null,
      clarifyingQuestion: null,
      changedOutcome: false,
    });
  });

  it("abstains on low confidence and preserves clarification", () => {
    expect(
      enforceSafetyPolicy(
        {
          ...baseInference,
          confidence: "low",
          clarifyingQuestion: "Was there sauce added after the photo?",
        },
        "req_low",
        { metrics, tracer },
      ),
    ).toMatchObject({
      status: "abstained",
      policyFlags: ["LOW_CONFIDENCE"],
      abstained: true,
      reason: "LOW_CONFIDENCE",
      clarifyingQuestion: "Was there sauce added after the photo?",
      changedOutcome: true,
    });

    expect(metrics.increment).toHaveBeenCalledWith("low_confidence_responses_total");
    expect(metrics.increment).toHaveBeenCalledWith("abstentions_total");
  });

  it("blocks medical-advice-like output", () => {
    expect(
      enforceSafetyPolicy(
        {
          ...baseInference,
          clarifyingQuestion: "Is this safe for your condition?",
        },
        "req_block",
        { metrics, tracer },
      ),
    ).toMatchObject({
      status: "abstained",
      policyFlags: ["MEDICAL_ADVICE_BLOCKED"],
      abstained: true,
      reason: "MEDICAL_ADVICE_BLOCKED",
      clarifyingQuestion: null,
      changedOutcome: true,
    });

    expect(metrics.increment).toHaveBeenCalledWith("output_policy_blocks_total");
  });

  it("tracks null estimates", () => {
    enforceSafetyPolicy(
      {
        ...baseInference,
        nutritionEstimate: null,
      },
      "req_null",
      { metrics, tracer },
    );

    expect(metrics.increment).toHaveBeenCalledWith("null_estimate_responses_total");
  });

  it("can keep low-confidence outputs when the demo flag disables forced abstention", () => {
    expect(
      enforceSafetyPolicy(
        {
          ...baseInference,
          confidence: "low",
          abstainRecommended: false,
        },
        "req_demo",
        {
          metrics,
          tracer,
          forceAbstainOnLowConfidence: false,
        },
      ),
    ).toEqual({
      status: "ok",
      policyFlags: [],
      abstained: false,
      reason: null,
      clarifyingQuestion: null,
      changedOutcome: false,
    });
  });
});
