import type {
  ConfidenceLevel,
  DetectedItem,
  NutritionEstimate,
  PolicyFlag,
} from "./api";
import type { FetchPolicyConfig } from "./config";

export interface ImageFetchMetadata {
  finalUrl: string;
  contentType: string;
  contentLength: number | null;
  bytesSampled: number;
  redirectCount: number;
  policy: FetchPolicyConfig;
}

export interface InputGuardrailsResult {
  accepted: boolean;
  rejectionCode: string | null;
  rejectionReason: string | null;
  normalizedImageUrl: string;
  fetchedImage: ImageFetchMetadata | null;
  policyFlags: PolicyFlag[];
}

export interface UnsafeScreeningResult {
  allowed: boolean;
  reasonCode: string | null;
  policyFlags: PolicyFlag[];
}

export interface MealExtractionItem {
  name: string;
  evidence: "visible" | "inferred";
  confidence: ConfidenceLevel;
  portionEstimate: number;
  portionUnit: string;
  reasoningNote: string;
}

export interface MealExtractionResult {
  mealDetected: boolean;
  unsafeOrDisallowedDetected: boolean;
  imageUsable: boolean;
  confidence: ConfidenceLevel;
  detectedItems: MealExtractionItem[];
  uncertaintyNotes: string[];
  clarifyingQuestion: string | null;
  abstainRecommended: boolean;
  modelFlags: PolicyFlag[];
}

export type NutritionMatchMethod = "exact" | "alias" | "embedding";

export interface NutritionGroundingMatch {
  extractedItemName: string;
  canonicalName: string | null;
  matchMethod: NutritionMatchMethod | null;
  matchConfidence: number | null;
}

export interface MealInferenceResult {
  confidence: ConfidenceLevel;
  detectedItems: DetectedItem[];
  nutritionEstimate: NutritionEstimate | null;
  uncertaintyNotes: string[];
  clarifyingQuestion: string | null;
  abstainRecommended: boolean;
  modelFlags: PolicyFlag[];
  groundingMatches: NutritionGroundingMatch[];
}

export interface OutputGuardrailsResult {
  status: "ok" | "abstained";
  policyFlags: PolicyFlag[];
  abstained: boolean;
  reason: string | null;
  clarifyingQuestion: string | null;
  changedOutcome: boolean;
}
