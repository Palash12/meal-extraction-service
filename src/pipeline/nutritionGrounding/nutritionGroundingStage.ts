import type { OpenAIClient } from "../../clients/openaiClient";
import { computeNutritionEstimate } from "../../services/nutritionGrounding/computeNutritionEstimate";
import { findNutritionMatches } from "../../services/nutritionGrounding/findNutritionMatches";
import { loadNutritionKb } from "../../services/nutritionGrounding/loadNutritionKb";
import type { NutritionGroundingResult } from "../../services/nutritionGrounding/types";
import type { DetectedItem } from "../../types/api";
import type { MealExtractionResult } from "../../types/pipeline";

function toDetectedItems(
  extractedItems: MealExtractionResult["detectedItems"],
): DetectedItem[] {
  return extractedItems.map((item) => ({
    name: item.name,
    evidence: item.evidence,
    confidence: item.confidence,
  }));
}

function mergeNotes(...noteGroups: string[][]): string[] {
  return Array.from(new Set(noteGroups.flat().filter((note) => note.trim().length > 0)));
}

export async function runNutritionGroundingStage(
  extraction: MealExtractionResult,
  openAIClient: OpenAIClient,
): Promise<NutritionGroundingResult> {
  const baseNotes = [...extraction.uncertaintyNotes];

  if (!extraction.imageUsable) {
    return {
      confidence: extraction.confidence,
      detectedItems: toDetectedItems(extraction.detectedItems),
      nutritionEstimate: null,
      uncertaintyNotes: mergeNotes(baseNotes, [
        "The image was not usable enough for reliable nutrition grounding.",
      ]),
      clarifyingQuestion: extraction.clarifyingQuestion,
      abstainRecommended: true,
      modelFlags: extraction.modelFlags,
      groundingMatches: [],
    };
  }

  if (!extraction.mealDetected) {
    return {
      confidence: extraction.confidence,
      detectedItems: toDetectedItems(extraction.detectedItems),
      nutritionEstimate: null,
      uncertaintyNotes: mergeNotes(baseNotes, [
        "No clear meal was detected for trusted nutrition grounding.",
      ]),
      clarifyingQuestion: extraction.clarifyingQuestion,
      abstainRecommended: true,
      modelFlags: extraction.modelFlags,
      groundingMatches: [],
    };
  }

  const kbEntries = loadNutritionKb();
  const matches = await findNutritionMatches(
    extraction.detectedItems,
    kbEntries,
    openAIClient,
  );
  const computedEstimate = computeNutritionEstimate(matches);
  const unsafeNote = extraction.unsafeOrDisallowedDetected
    ? ["The model noted potentially unsafe or disallowed content cues."]
    : [];

  return {
    confidence: extraction.confidence,
    detectedItems: toDetectedItems(extraction.detectedItems),
    nutritionEstimate: computedEstimate.nutritionEstimate,
    uncertaintyNotes: mergeNotes(baseNotes, computedEstimate.notes, unsafeNote),
    clarifyingQuestion: extraction.clarifyingQuestion,
    abstainRecommended:
      extraction.abstainRecommended || computedEstimate.shouldAbstain,
    modelFlags: extraction.modelFlags,
    groundingMatches: matches.map((match) => ({
      extractedItemName: match.extractedItem.name,
      canonicalName: match.entry?.canonical_name ?? null,
      matchMethod: match.matchMethod,
      matchConfidence: match.matchConfidence,
    })),
  };
}
