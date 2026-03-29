import { runNutritionGroundingStage } from "../../src/pipeline/nutritionGrounding/nutritionGroundingStage";
import {
  findNutritionMatch,
  resetNutritionEmbeddingCache,
} from "../../src/services/nutritionGrounding/findNutritionMatches";
import {
  loadNutritionKb,
  resetNutritionKbCache,
} from "../../src/services/nutritionGrounding/loadNutritionKb";
import type { MealExtractionResult } from "../../src/types/pipeline";

function createExtractionResult(
  overrides: Partial<MealExtractionResult> = {},
): MealExtractionResult {
  return {
    mealDetected: true,
    unsafeOrDisallowedDetected: false,
    imageUsable: true,
    confidence: "medium",
    detectedItems: [
      {
        name: "grilled chicken thigh",
        evidence: "visible",
        confidence: "high",
        portionEstimate: 150,
        portionUnit: "g",
        reasoningNote: "A grilled chicken portion is visible on the plate.",
      },
      {
        name: "white rice",
        evidence: "visible",
        confidence: "high",
        portionEstimate: 200,
        portionUnit: "g",
        reasoningNote: "A rice side is clearly visible beside the protein.",
      },
    ],
    uncertaintyNotes: ["Portion size is estimated from a single image."],
    clarifyingQuestion: null,
    abstainRecommended: false,
    modelFlags: [],
    ...overrides,
  };
}

describe("nutrition grounding", () => {
  beforeEach(() => {
    resetNutritionKbCache();
    resetNutritionEmbeddingCache();
  });

  it("loads the local nutrition KB from src/data/nutritionKb.json", () => {
    const kb = loadNutritionKb();

    expect(kb.length).toBeGreaterThan(0);
    expect(kb).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          canonical_name: "grilled chicken thigh",
        }),
        expect.objectContaining({
          canonical_name: "fish curry",
        }),
        expect.objectContaining({
          canonical_name: "butter chicken",
        }),
        expect.objectContaining({
          canonical_name: "pecans",
        }),
      ]),
    );
  });

  it("finds an exact canonical match first", async () => {
    const kb = loadNutritionKb();

    const match = await findNutritionMatch(
      {
        name: "grilled chicken thigh",
        evidence: "visible",
        confidence: "high",
        portionEstimate: 150,
        portionUnit: "g",
        reasoningNote: "Chicken is visible.",
      },
      kb,
    );

    expect(match.entry?.canonical_name).toBe("grilled chicken thigh");
    expect(match.matchMethod).toBe("exact");
    expect(match.matchConfidence).toBe(1);
  });

  it("uses aliases before embeddings", async () => {
    const kb = loadNutritionKb();

    const match = await findNutritionMatch(
      {
        name: "white rice",
        evidence: "visible",
        confidence: "high",
        portionEstimate: 200,
        portionUnit: "g",
        reasoningNote: "Rice is visible.",
      },
      kb,
    );

    expect(match.entry?.canonical_name).toBe("cooked white rice");
    expect(match.matchMethod).toBe("alias");
    expect(match.matchConfidence).toBe(0.92);
  });

  it("matches mixed leafy salad through direct aliases", async () => {
    const kb = loadNutritionKb();

    const match = await findNutritionMatch(
      {
        name: "mixed leafy salad",
        evidence: "visible",
        confidence: "high",
        portionEstimate: 85,
        portionUnit: "g",
        reasoningNote: "Leafy greens are visible on the plate.",
      },
      kb,
    );

    expect(match.entry?.canonical_name).toBe("green salad");
    expect(match.matchMethod).toBe("alias");
    expect(match.matchConfidence).toBe(0.92);
  });

  it("matches the new ingredient-level salad items directly", async () => {
    const kb = loadNutritionKb();

    const spinach = await findNutritionMatch(
      {
        name: "spinach leaves",
        evidence: "visible",
        confidence: "high",
        portionEstimate: 30,
        portionUnit: "g",
        reasoningNote: "Spinach leaves are visible.",
      },
      kb,
    );
    const pecan = await findNutritionMatch(
      {
        name: "pecan",
        evidence: "visible",
        confidence: "high",
        portionEstimate: 14,
        portionUnit: "g",
        reasoningNote: "A pecan topping is visible.",
      },
      kb,
    );
    const dressing = await findNutritionMatch(
      {
        name: "salad dressing or oil",
        evidence: "inferred",
        confidence: "medium",
        portionEstimate: 15,
        portionUnit: "g",
        reasoningNote: "A light dressing is inferred.",
      },
      kb,
    );

    expect(spinach.entry?.canonical_name).toBe("spinach leaves");
    expect(spinach.matchMethod).toBe("exact");
    expect(pecan.entry?.canonical_name).toBe("pecans");
    expect(pecan.matchMethod).toBe("alias");
    expect(dressing.entry?.canonical_name).toBe("salad dressing");
    expect(dressing.matchMethod).toBe("alias");
  });

  it("finds an exact match for butter chicken", async () => {
    const kb = loadNutritionKb();

    const match = await findNutritionMatch(
      {
        name: "butter chicken",
        evidence: "visible",
        confidence: "high",
        portionEstimate: 180,
        portionUnit: "g",
        reasoningNote: "A creamy orange chicken curry is visible.",
      },
      kb,
    );

    expect(match.entry?.canonical_name).toBe("butter chicken");
    expect(match.matchMethod).toBe("exact");
    expect(match.matchConfidence).toBe(1);
  });

  it("falls back to embeddings only when no exact or alias match exists", async () => {
    const kb = loadNutritionKb();
    const embeddingProvider = {
      embedTexts: jest.fn(async (texts: string[]) =>
        texts.map((text) => {
          if (text === "chargrilled chicken") {
            return [1, 0];
          }

          if (
            text === "grilled chicken breast" ||
            text === "grilled chicken"
          ) {
            return [0.98, 0.02];
          }

          return [0, 1];
        }),
      ),
    };

    const match = await findNutritionMatch(
      {
        name: "chargrilled chicken",
        evidence: "visible",
        confidence: "medium",
        portionEstimate: 120,
        portionUnit: "g",
        reasoningNote: "A grilled chicken portion is visible.",
      },
      kb,
      embeddingProvider,
    );

    expect(match.entry?.canonical_name).toBe("grilled chicken breast");
    expect(match.matchMethod).toBe("embedding");
    expect(match.matchConfidence).toBeGreaterThanOrEqual(0.75);
  });

  it("propagates uncertainty when grounding relies on a weak match", async () => {
    const embeddingProvider = {
      embedTexts: jest.fn(async (texts: string[]) =>
        texts.map((text) => {
          if (text === "spiced tomato rice plate") {
            return [1, 0];
          }

          if (text === "jollof rice") {
            return [0.8, 0.6];
          }

          return [0, 1];
        }),
      ),
    };

    const result = await runNutritionGroundingStage(
      createExtractionResult({
        detectedItems: [
          {
            name: "spiced tomato rice plate",
            evidence: "visible",
            confidence: "medium",
            portionEstimate: 180,
            portionUnit: "g",
            reasoningNote: "A red rice dish is visible.",
          },
        ],
      }),
      embeddingProvider as never,
    );

    expect(result.nutritionEstimate).not.toBeNull();
    expect(result.uncertaintyNotes).toEqual(
      expect.arrayContaining([
        expect.stringContaining("weaker KB match"),
      ]),
    );
  });

  it("computes a grounded nutrition estimate from trusted KB matches", async () => {
    const result = await runNutritionGroundingStage(
      createExtractionResult(),
      { embedTexts: jest.fn() } as never,
    );

    expect(result.detectedItems).toEqual([
      { name: "grilled chicken thigh", evidence: "visible", confidence: "high" },
      { name: "white rice", evidence: "visible", confidence: "high" },
    ]);
    expect(result.groundingMatches).toEqual([
      {
        extractedItemName: "grilled chicken thigh",
        canonicalName: "grilled chicken thigh",
        matchMethod: "exact",
        matchConfidence: 1,
      },
      {
        extractedItemName: "white rice",
        canonicalName: "cooked white rice",
        matchMethod: "alias",
        matchConfidence: 0.92,
      },
    ]);
    expect(result.nutritionEstimate).toEqual({
      calories: { lower: 474.5, upper: 672.5 },
      protein_g: { lower: 36.9, upper: 50.6 },
      carbs_g: { lower: 45.1, upper: 67.7 },
      fat_g: { lower: 14.4, upper: 19.5 },
    });
    expect(result.abstainRecommended).toBe(false);
  });

  it("keeps a clear meal non-abstaining when core items are grounded but minor items are unmatched", async () => {
    const result = await runNutritionGroundingStage(
      createExtractionResult({
        detectedItems: [
          {
            name: "grilled chicken thigh",
            evidence: "visible",
            confidence: "high",
            portionEstimate: 150,
            portionUnit: "g",
            reasoningNote: "Chicken is the main visible protein.",
          },
          {
            name: "white rice",
            evidence: "visible",
            confidence: "high",
            portionEstimate: 200,
            portionUnit: "g",
            reasoningNote: "Rice is clearly visible.",
          },
          {
            name: "sesame seeds",
            evidence: "visible",
            confidence: "medium",
            portionEstimate: 15,
            portionUnit: "g",
            reasoningNote: "Small topping scattered on the plate.",
          },
        ],
      }),
      { embedTexts: jest.fn() } as never,
    );

    expect(result.nutritionEstimate).not.toBeNull();
    expect(result.abstainRecommended).toBe(false);
    expect(result.uncertaintyNotes).toEqual(
      expect.arrayContaining([
        expect.stringContaining("excluded 1 extracted item"),
      ]),
    );
  });

  it("grounds the clear meal demo image items without forced abstention", async () => {
    const result = await runNutritionGroundingStage(
      createExtractionResult({
        confidence: "high",
        detectedItems: [
          {
            name: "cooked white rice",
            evidence: "visible",
            confidence: "high",
            portionEstimate: 150,
            portionUnit: "g",
            reasoningNote: "A serving of rice is visible.",
          },
          {
            name: "cooked chicken piece",
            evidence: "visible",
            confidence: "high",
            portionEstimate: 120,
            portionUnit: "g",
            reasoningNote: "Cooked chicken pieces are visible.",
          },
          {
            name: "spinach leaves",
            evidence: "visible",
            confidence: "high",
            portionEstimate: 30,
            portionUnit: "g",
            reasoningNote: "Spinach leaves are visible.",
          },
          {
            name: "chopped cucumber",
            evidence: "visible",
            confidence: "high",
            portionEstimate: 50,
            portionUnit: "g",
            reasoningNote: "Chopped cucumber is visible.",
          },
          {
            name: "tomato",
            evidence: "visible",
            confidence: "high",
            portionEstimate: 60,
            portionUnit: "g",
            reasoningNote: "Tomato is visible.",
          },
          {
            name: "red bell pepper",
            evidence: "visible",
            confidence: "medium",
            portionEstimate: 40,
            portionUnit: "g",
            reasoningNote: "Red bell pepper is visible.",
          },
          {
            name: "red onion",
            evidence: "visible",
            confidence: "medium",
            portionEstimate: 20,
            portionUnit: "g",
            reasoningNote: "Red onion is visible.",
          },
          {
            name: "dried cranberries",
            evidence: "visible",
            confidence: "medium",
            portionEstimate: 15,
            portionUnit: "g",
            reasoningNote: "Dried cranberries are visible.",
          },
          {
            name: "pecan",
            evidence: "visible",
            confidence: "high",
            portionEstimate: 14,
            portionUnit: "g",
            reasoningNote: "Pecan topping is visible.",
          },
          {
            name: "pumpkin seeds",
            evidence: "visible",
            confidence: "medium",
            portionEstimate: 10,
            portionUnit: "g",
            reasoningNote: "Pumpkin seeds are visible.",
          },
          {
            name: "salad dressing or oil",
            evidence: "inferred",
            confidence: "medium",
            portionEstimate: 15,
            portionUnit: "g",
            reasoningNote: "Dressing is inferred from the salad sheen.",
          },
        ],
      }),
      { embedTexts: jest.fn() } as never,
    );

    expect(result.abstainRecommended).toBe(false);
    expect(result.groundingMatches).toEqual(
      expect.arrayContaining([
        {
          extractedItemName: "cooked white rice",
          canonicalName: "cooked white rice",
          matchMethod: "exact",
          matchConfidence: 1,
        },
        {
          extractedItemName: "cooked chicken piece",
          canonicalName: "cooked chicken",
          matchMethod: "alias",
          matchConfidence: 0.92,
        },
        {
          extractedItemName: "spinach leaves",
          canonicalName: "spinach leaves",
          matchMethod: "exact",
          matchConfidence: 1,
        },
        {
          extractedItemName: "salad dressing or oil",
          canonicalName: "salad dressing",
          matchMethod: "alias",
          matchConfidence: 0.92,
        },
      ]),
    );
    expect(result.groundingMatches).toHaveLength(11);
    expect(result.nutritionEstimate).not.toBeNull();
    expect(result.uncertaintyNotes).toEqual(
      expect.arrayContaining(["Portion size is estimated from a single image."]),
    );
    expect(result.uncertaintyNotes).not.toEqual(
      expect.arrayContaining([
        expect.stringContaining("No trusted nutrition KB match"),
        expect.stringContaining("weaker KB match"),
      ]),
    );
  });

  it("grounds a butter chicken plate without abstaining when core items are covered", async () => {
    const result = await runNutritionGroundingStage(
      createExtractionResult({
        confidence: "high",
        detectedItems: [
          {
            name: "butter chicken",
            evidence: "visible",
            confidence: "high",
            portionEstimate: 180,
            portionUnit: "g",
            reasoningNote: "Butter chicken is visible in a curry bowl.",
          },
          {
            name: "basmati rice",
            evidence: "visible",
            confidence: "high",
            portionEstimate: 160,
            portionUnit: "g",
            reasoningNote: "A serving of basmati rice is visible.",
          },
          {
            name: "naan",
            evidence: "visible",
            confidence: "high",
            portionEstimate: 60,
            portionUnit: "g",
            reasoningNote: "A piece of naan is visible next to the curry.",
          },
        ],
      }),
      { embedTexts: jest.fn() } as never,
    );

    expect(result.abstainRecommended).toBe(false);
    expect(result.groundingMatches).toEqual([
      {
        extractedItemName: "butter chicken",
        canonicalName: "butter chicken",
        matchMethod: "exact",
        matchConfidence: 1,
      },
      {
        extractedItemName: "basmati rice",
        canonicalName: "cooked white rice",
        matchMethod: "alias",
        matchConfidence: 0.92,
      },
      {
        extractedItemName: "naan",
        canonicalName: "naan",
        matchMethod: "exact",
        matchConfidence: 1,
      },
    ]);
    expect(result.nutritionEstimate).not.toBeNull();
    expect(result.uncertaintyNotes).toEqual(
      expect.arrayContaining(["Portion size is estimated from a single image."]),
    );
  });

  it("preserves abstention behavior when no meal can be grounded", async () => {
    const result = await runNutritionGroundingStage(
      createExtractionResult({
        mealDetected: false,
        detectedItems: [],
        confidence: "low",
        abstainRecommended: true,
        clarifyingQuestion: "Was there food outside the frame?",
      }),
      { embedTexts: jest.fn() } as never,
    );

    expect(result.nutritionEstimate).toBeNull();
    expect(result.abstainRecommended).toBe(true);
    expect(result.clarifyingQuestion).toBe("Was there food outside the frame?");
    expect(result.uncertaintyNotes).toEqual(
      expect.arrayContaining([
        "No clear meal was detected for trusted nutrition grounding.",
      ]),
    );
  });
});
