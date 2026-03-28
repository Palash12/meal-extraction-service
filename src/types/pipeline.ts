import type { ConfidenceLevel, DetectedItem, NutritionEstimate, PolicyFlag } from "./api";
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

export interface MealInferenceResult {
  confidence: ConfidenceLevel;
  detectedItems: DetectedItem[];
  nutritionEstimate: NutritionEstimate | null;
  uncertaintyNotes: string[];
  clarifyingQuestion: string | null;
  abstainRecommended: boolean;
  modelFlags: PolicyFlag[];
}

export interface OutputGuardrailsResult {
  status: "ok" | "abstained";
  policyFlags: PolicyFlag[];
  abstained: boolean;
  reason: string | null;
  clarifyingQuestion: string | null;
  changedOutcome: boolean;
}
