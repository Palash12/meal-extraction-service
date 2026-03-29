# Code Samples For Slides

These samples are real excerpts from this repository. They are intentionally short and slide-friendly.

## 1. Orchestrator Stage Sequencing

Why it is worth showing:

- It proves the MVP is a deterministic pipeline, not a vague agent loop.

File path:

- `src/pipeline/orchestrator/mealAnalysisOrchestrator.ts`

Excerpt:

```ts
const fetchedImage = await fetchImageMetadata(
  this.dependencies.imageFetchClient,
  request.image_url,
  trace.requestId,
);
const inputGuardrails = assessImageUsability(fetchedImage);

const unsafeScreening = await moderateUnsafeImage(
  this.dependencies.openAIClient,
  fetchedImage,
  trace.requestId,
);

const inference = await runMealInference(
  this.dependencies.openAIClient,
  request,
);

const groundedInference = await runNutritionGroundingStage(
  inference,
  this.dependencies.openAIClient,
);
```

What to highlight verbally:

- one fetch
- one moderation step
- one inference call
- then local grounding

Best supports:

- architecture slide

Worth showing live in editor:

- yes

## 2. Local Image Guardrails

Why it is worth showing:

- It makes “guardrails” concrete for engineers.

File path:

- `src/pipeline/inputGuardrails/assessImageUsability.ts`

Excerpt:

```ts
const MINIMUM_IMAGE_BYTES = 32;
const ALLOWED_CONTENT_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

if (!ALLOWED_CONTENT_TYPES.has(metadata.contentType)) {
  return {
    accepted: false,
    rejectionCode: "INPUT_REJECTED",
    rejectionReason: "Image content type is not usable",
    policyFlags: ["UNUSABLE_IMAGE"],
  };
}
```

What to highlight verbally:

- cheap early rejection
- no model call needed for obvious bad inputs

Best supports:

- input guardrails slide

Worth showing live in editor:

- yes

## 3. Unsafe Screening Call

Why it is worth showing:

- It shows the repo uses a dedicated moderation step instead of overloading the main model.

File path:

- `src/clients/openaiClient.ts`

Excerpt:

```ts
const response = await this.openai.moderations.create({
  model: this.models.moderationModel,
  input: [
    {
      type: "image_url",
      image_url: {
        url: imageUrl,
      },
    },
  ],
});
```

What to highlight verbally:

- dedicated moderation model
- early stop before inference if blocked

Best supports:

- safety architecture slide

Worth showing live in editor:

- yes

## 4. Main Structured Meal Extraction Call

Why it is worth showing:

- It demonstrates structured outputs and the single main multimodal call.

File path:

- `src/clients/openaiClient.ts`

Excerpt:

```ts
const response = await this.openai.responses.create({
  model: this.models.inferenceModel,
  store: false,
  stream: false,
  input: [/* developer prompt + user image */],
  text: {
    format: {
      type: "json_schema",
      name: "meal_inference",
      schema: mealInferenceModelJsonSchema,
      strict: true,
    },
  },
  max_output_tokens: this.models.maxOutputTokens ?? undefined,
});
```

What to highlight verbally:

- structured outputs
- one main meal-extraction call
- token cap lever

Best supports:

- model tradeoffs slide

Worth showing live in editor:

- yes

## 5. Extraction Schema Shape

Why it is worth showing:

- It makes the model contract precise and reviewable.

File path:

- `src/schemas/mealInferenceModel.ts`

Excerpt:

```ts
export const MealInferenceModelOutputSchema = z
  .object({
    mealDetected: z.boolean(),
    unsafeOrDisallowedDetected: z.boolean(),
    imageUsable: z.boolean(),
    confidence: ConfidenceLevelSchema,
    detectedItems: z.array(MealExtractionItemSchema),
    uncertaintyNotes: z.array(z.string().trim().min(1)),
    clarifyingQuestion: z.string().trim().min(1).nullable(),
    abstainRecommended: z.boolean(),
  })
  .strict();
```

What to highlight verbally:

- the model does extraction, not unconstrained nutrition generation
- uncertainty is part of the contract

Best supports:

- inference design slide

Worth showing live in editor:

- yes

## 6. Local Nutrition Grounding Fallback Logic

Why it is worth showing:

- It captures the core “grounding before response” idea.

File path:

- `src/services/nutritionGrounding/findNutritionMatches.ts`

Excerpt:

```ts
const ACCEPTABLE_EMBEDDING_MATCH_THRESHOLD = 0.75;
const STRONG_EMBEDDING_MATCH_THRESHOLD = 0.88;

const exactOrAliasMatch = aliasIndex.get(normalizedName);

if (exactOrAliasMatch) {
  return {
    entry: exactOrAliasMatch.entry,
    matchMethod: exactOrAliasMatch.method,
    matchConfidence: exactOrAliasMatch.method === "exact" ? 1 : 0.92,
  };
}
```

What to highlight verbally:

- deterministic first
- embeddings only as fallback
- explicit thresholds

Best supports:

- grounding / tradeoff slide

Worth showing live in editor:

- yes

## 7. Output Guardrail Decision

Why it is worth showing:

- It shows how abstention is enforced locally.

File path:

- `src/pipeline/outputGuardrails/enforceSafetyPolicy.ts`

Excerpt:

```ts
if (
  result.abstainRecommended ||
  (forceAbstainOnLowConfidence && result.confidence === "low")
) {
  const nextFlags = appendPolicyFlag(policyFlags, "LOW_CONFIDENCE");

  return buildChangedResult(requestId, {
    status: "abstained",
    policyFlags: nextFlags,
    abstained: true,
    reason: "LOW_CONFIDENCE",
    clarifyingQuestion: result.clarifyingQuestion,
  }, Date.now() - startedAt, demoObservability, result.confidence);
}
```

What to highlight verbally:

- confidence alone does not silently pass through
- abstention is a product behavior, not just a model accident

Best supports:

- output guardrails slide

Worth showing live in editor:

- yes

## 8. Demo Feature Flags

Why it is worth showing:

- It makes live tradeoff demos concrete.

File path:

- `src/services/config/featureFlags.ts`

Excerpt:

```ts
export const featureFlags: FeatureFlags = {
  demoMode: env.DEMO_MODE,
  decisionLoggingEnabled: env.DECISION_LOGGING_ENABLED,
  enableUnsafeScreening: env.ENABLE_UNSAFE_SCREENING,
  enableOutputGuardrails: env.ENABLE_OUTPUT_GUARDRAILS,
  forceAbstainOnLowConfidence: env.FORCE_ABSTAIN_ON_LOW_CONFIDENCE,
  inferenceModelOverride: env.DEMO_MODE
    ? (env.INFERENCE_MODEL_OVERRIDE ?? null)
    : null,
};
```

What to highlight verbally:

- demo levers are explicit
- risky overrides are gated behind demo mode

Best supports:

- demo walkthrough slide

Worth showing live in editor:

- yes

## 9. Integration Test For Stable API Behavior

Why it is worth showing:

- It proves the behavior is tested end to end, not just described.

File path:

- `tests/integration/mealAnalysisEndpoint.test.ts`

Excerpt:

```ts
expect(response.body).toEqual({
  requestId: response.headers["x-request-id"],
  status: "ok",
  confidence: "medium",
  detectedItems: [
    { name: "rice", evidence: "visible", confidence: "high" },
  ],
  nutritionEstimate: {
    calories: { lower: 208, upper: 312 },
    protein_g: { lower: 3.8, upper: 5.8 },
```

What to highlight verbally:

- stable public contract
- grounded nutrition ranges
- request ID propagation

Best supports:

- reliability / testing slide

Worth showing live in editor:

- yes

## Suggested Usage On Slides

- Use samples 1, 4, 6, and 7 for the main architecture story.
- Use sample 8 for the demo/tradeoff story.
- Use sample 9 for credibility with engineering reviewers.
- If time is tight, show 1, 4, 6, 7, and 9 only.
