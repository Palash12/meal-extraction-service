export interface MealExtractionRequest {
  image_url: string;
  user_note?: string;
  request_id?: string;
}

export type PortionSize =
  | "very_small"
  | "small"
  | "medium"
  | "large"
  | "very_large"
  | "unknown";

export type ConfidenceLevel = "low" | "medium" | "high";

export interface PortionEstimate {
  size: PortionSize;
  confidence: ConfidenceLevel;
  notes: string;
}

export interface MealExtractionResult {
  dish_candidates: string[];
  visible_components: string[];
  portion_estimate: PortionEstimate;
  observed: string[];
  assumed: string[];
  unknown: string[];
  needs_user_confirmation: boolean;
  clarifying_question: string | null;
}

export interface ErrorResponse {
  error: {
    code: string;
    message: string;
    retryable: boolean;
  };
}

export type MealAnalysisStatus = "ok" | "abstained" | "rejected_input" | "error";
export type PolicyFlag =
  | "UNSAFE_IMAGE"
  | "LOW_CONFIDENCE"
  | "MEDICAL_ADVICE_BLOCKED"
  | "NON_FOOD_IMAGE"
  | "UNUSABLE_IMAGE"
  | "FORCED_ABSTENTION";
export type ErrorCode =
  | "VALIDATION_ERROR"
  | "INPUT_REJECTED"
  | "FETCH_FAILED"
  | "FETCH_TIMEOUT"
  | "UPSTREAM_INFERENCE_FAILURE"
  | "UPSTREAM_TIMEOUT"
  | "POLICY_BLOCKED"
  | "INTERNAL_SERVER_ERROR"
  | "NOT_FOUND";

export interface DetectedItem {
  name: string;
  evidence: "visible" | "inferred";
  confidence: ConfidenceLevel;
}

export interface NutritionRange {
  lower: number;
  upper: number;
}

export interface NutritionEstimate {
  calories: NutritionRange | null;
  protein_g: NutritionRange | null;
  carbs_g: NutritionRange | null;
  fat_g: NutritionRange | null;
}

export interface MealAnalysisRequest {
  image_url: string;
  user_note?: string;
  request_id?: string;
}

export interface MealAnalysisResponse {
  requestId: string;
  status: MealAnalysisStatus;
  confidence: ConfidenceLevel | null;
  detectedItems: DetectedItem[];
  nutritionEstimate: NutritionEstimate | null;
  uncertaintyNotes: string[];
  clarifyingQuestion: string | null;
  policyFlags: PolicyFlag[];
  abstained: boolean;
  reason: string | null;
}
