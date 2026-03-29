import type {
  ConfidenceLevel,
  NutritionEstimate,
  PolicyFlag,
} from "../../types/api";
import type {
  MealExtractionItem,
  NutritionMatchMethod,
} from "../../types/pipeline";

export interface NutritionKbEntry {
  id: string;
  canonical_name: string;
  aliases: string[];
  serving_unit: string;
  calories_per_serving: number;
  protein_g_per_serving: number;
  carbs_g_per_serving: number;
  fat_g_per_serving: number;
  tags: string[];
}

export interface NutritionMatchResult {
  extractedItem: MealExtractionItem;
  entry: NutritionKbEntry | null;
  matchMethod: NutritionMatchMethod | null;
  matchConfidence: number | null;
}

export interface NutritionEstimateComputation {
  nutritionEstimate: NutritionEstimate | null;
  notes: string[];
  shouldAbstain: boolean;
}

export interface NutritionGroundingResult {
  confidence: ConfidenceLevel;
  detectedItems: Array<{
    name: string;
    evidence: "visible" | "inferred";
    confidence: ConfidenceLevel;
  }>;
  nutritionEstimate: NutritionEstimate | null;
  uncertaintyNotes: string[];
  clarifyingQuestion: string | null;
  abstainRecommended: boolean;
  modelFlags: PolicyFlag[];
  groundingMatches: Array<{
    extractedItemName: string;
    canonicalName: string | null;
    matchMethod: NutritionMatchMethod | null;
    matchConfidence: number | null;
  }>;
}
