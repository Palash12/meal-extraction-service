import type { ConfidenceLevel, NutritionEstimate, NutritionRange } from "../../types/api";
import type { NutritionMatchResult } from "./types";
import { isWeakNutritionMatch } from "./findNutritionMatches";

function roundNumber(value: number): number {
  return Number(value.toFixed(1));
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function parseServingUnitGrams(servingUnit: string): number | null {
  const match = servingUnit.trim().toLowerCase().match(/^(\d+(?:\.\d+)?)g$/);
  if (!match) {
    return null;
  }

  return Number(match[1]);
}

function normalizeUnit(unit: string): string {
  return unit.trim().toLowerCase();
}

function computeServingMultiplier(
  portionEstimate: number,
  portionUnit: string,
  servingUnit: string,
): number {
  const normalizedPortionUnit = normalizeUnit(portionUnit);
  const normalizedServingUnit = normalizeUnit(servingUnit);

  if (normalizedPortionUnit === normalizedServingUnit) {
    return portionEstimate;
  }

  const servingGrams = parseServingUnitGrams(normalizedServingUnit);
  if (
    servingGrams !== null &&
    ["g", "gram", "grams"].includes(normalizedPortionUnit)
  ) {
    return portionEstimate / servingGrams;
  }

  if (
    ["serving", "servings", "portion", "portions", "plate", "plates", "bowl", "bowls"].includes(
      normalizedPortionUnit,
    )
  ) {
    return portionEstimate;
  }

  return 1;
}

function confidencePenalty(confidence: ConfidenceLevel): number {
  if (confidence === "high") {
    return 0;
  }

  if (confidence === "medium") {
    return 0.05;
  }

  return 0.15;
}

function marginForMatch(match: NutritionMatchResult): number {
  const methodPenalty =
    match.matchMethod === "exact"
      ? 0.15
      : match.matchMethod === "alias"
        ? 0.2
        : 0.3;
  const evidencePenalty =
    match.extractedItem.evidence === "inferred" ? 0.1 : 0;

  return clamp(
    methodPenalty +
      evidencePenalty +
      confidencePenalty(match.extractedItem.confidence),
    0.1,
    0.45,
  );
}

function buildRange(value: number, margin: number): NutritionRange {
  return {
    lower: roundNumber(value * (1 - margin)),
    upper: roundNumber(value * (1 + margin)),
  };
}

function sumRanges(ranges: NutritionRange[]): NutritionRange | null {
  if (ranges.length === 0) {
    return null;
  }

  return {
    lower: roundNumber(ranges.reduce((sum, range) => sum + range.lower, 0)),
    upper: roundNumber(ranges.reduce((sum, range) => sum + range.upper, 0)),
  };
}

export function computeNutritionEstimate(
  matches: NutritionMatchResult[],
): { nutritionEstimate: NutritionEstimate | null; notes: string[]; shouldAbstain: boolean } {
  const notes: string[] = [];
  const calorieRanges: NutritionRange[] = [];
  const proteinRanges: NutritionRange[] = [];
  const carbRanges: NutritionRange[] = [];
  const fatRanges: NutritionRange[] = [];

  let matchedCount = 0;
  let unmatchedCount = 0;
  let unmatchedHighConfidenceVisibleCount = 0;

  for (const match of matches) {
    if (!match.entry) {
      unmatchedCount += 1;
      if (
        match.extractedItem.evidence === "visible" &&
        match.extractedItem.confidence !== "low"
      ) {
        unmatchedHighConfidenceVisibleCount += 1;
      }
      notes.push(
        `No trusted nutrition KB match was found for "${match.extractedItem.name}".`,
      );
      continue;
    }

    matchedCount += 1;

    const servingMultiplier = computeServingMultiplier(
      match.extractedItem.portionEstimate,
      match.extractedItem.portionUnit,
      match.entry.serving_unit,
    );
    const margin = marginForMatch(match);

    calorieRanges.push(
      buildRange(match.entry.calories_per_serving * servingMultiplier, margin),
    );
    proteinRanges.push(
      buildRange(match.entry.protein_g_per_serving * servingMultiplier, margin),
    );
    carbRanges.push(
      buildRange(match.entry.carbs_g_per_serving * servingMultiplier, margin),
    );
    fatRanges.push(
      buildRange(match.entry.fat_g_per_serving * servingMultiplier, margin),
    );

    if (isWeakNutritionMatch(match)) {
      notes.push(
        `Nutrition for "${match.extractedItem.name}" was grounded using a weaker KB match.`,
      );
    }
  }

  if (matchedCount === 0) {
    return {
      nutritionEstimate: null,
      notes,
      shouldAbstain: true,
    };
  }

  if (unmatchedCount > 0) {
    notes.push(
      `Nutrition grounding excluded ${unmatchedCount} extracted item(s) that were not matched in the local KB.`,
    );
  }

  const shouldAbstain =
    matchedCount === 0 ||
    (matchedCount < 2 &&
      unmatchedHighConfidenceVisibleCount >= matchedCount &&
      matches.length > 1);

  return {
    nutritionEstimate: {
      calories: sumRanges(calorieRanges),
      protein_g: sumRanges(proteinRanges),
      carbs_g: sumRanges(carbRanges),
      fat_g: sumRanges(fatRanges),
    },
    notes,
    shouldAbstain,
  };
}
