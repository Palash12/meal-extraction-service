# Model Selection And Tradeoffs

## Goal

This document explains where the current repo uses models, where deterministic logic is intentionally preferred, and what model choices are reasonable for a production-minded version of the assignment.

## Current Implementation

### Where multimodal reasoning is used today

In the current repo, multimodal reasoning is used in one main place:

- `OpenAIClient.inferMeal()` in `src/clients/openaiClient.ts`

That call receives:

- the prompt from `src/prompts/mealInference/mealNutritionEstimate.v1.txt`
- the meal image URL
- the optional `user_note`

It returns structured visual extraction only.

### Where model calls are used today

- unsafe screening:
  - `openai.moderations.create()`
  - model from `OPENAI_MODERATION_MODEL`
- meal extraction:
  - `openai.responses.create()`
  - model from `OPENAI_MODEL` or `INFERENCE_MODEL_OVERRIDE` in demo mode
- embedding fallback for KB matching:
  - `openai.embeddings.create()`
  - hardcoded default `"text-embedding-3-small"` unless `embeddingModel` is passed to `OpenAIClient`

### Where deterministic logic is used today

Deterministic logic is used for:

- request validation
- URL safety
- fetch limits and timeouts
- image content-type and minimum-byte checks
- nutrition KB loading
- exact and alias KB matching
- nutrition range computation
- output medical-advice suppression
- low-confidence abstention

That split is a good design choice for this assignment.

## Recommended Production Design

### Principle

Use model calls where perception or semantic matching is hard. Use deterministic logic where correctness, cost control, or explainability matter more.

### Recommended responsibility split

- model calls:
  - visual meal extraction
  - unsafe content screening
  - narrow semantic fallback for KB retrieval
- deterministic logic:
  - request validation
  - fetch policy
  - nutrition calculation
  - medical-advice suppression
  - response shaping
  - most thresholds and abstention policy

## Component Recommendations

| Component | Current approach in repo | Recommended model or method | Why it fits | Main tradeoffs | Likely failure modes |
|---|---|---|---|---|---|
| Input validation and fetch policy | Zod + local URL/fetch logic | Deterministic local code | Cheap, fast, auditable | Lower semantic coverage | Can’t detect non-food semantics by itself |
| Unsafe screening | `omni-moderation-latest` moderation call | Keep dedicated moderation model | Narrow task, cheaper than full multimodal reasoning | Extra latency, external dependency | False positives or misses on edge cases |
| Meal extraction | OpenAI Responses API with structured outputs, current default `gpt-5.4-mini` | `gpt-5.4-mini` for MVP; stronger multimodal model for harder ambiguity or higher accuracy targets | Main perception task needs multimodal reasoning | Accuracy vs latency/cost | Missed side items, over-inference, portion errors |
| Nutrition grounding exact/alias | Local KB matching | Deterministic local code | Explainable, fast, low-cost | Limited KB coverage | Misses long-tail foods or unexpected naming |
| Nutrition grounding fallback | Embeddings fallback only | Small embedding model such as `text-embedding-3-small` | Good retrieval assist without second synthesis call | Extra call on misses, possible weak semantic matches | Wrong nearest match, especially similar dishes |
| Output guardrails | Local regex and low-confidence policy | Keep deterministic local code; optionally add more policy tests | Cheap and reviewable | Narrow coverage vs broad policy models | Missed unsafe phrasing outside current regex set |

## Current Repo Tradeoffs

### Accuracy / usefulness

Strengths:

- structured extraction schema
- uncertainty notes
- clarifying question support
- local nutrition grounding instead of free-form model nutrition claims

Tradeoffs:

- KB coverage is intentionally small
- non-food handling is not deterministic before model use
- portion estimates still come from the model

### Latency

The current request path can include:

1. one bounded image fetch
2. one moderation call
3. one meal extraction call
4. optional embeddings call only on KB misses

This is leaner than a multi-call agentic design, but it still pays the cost of external moderation and inference.

### Cost

Current cost drivers:

- inference model choice
- image complexity
- output token cap
- whether embeddings fallback is needed

The repo correctly keeps nutrition computation local, which is a major cost-saving choice.

### Safety

Current safety strengths:

- early fetch constraints
- moderation-backed unsafe screening
- local abstention behavior
- local medical-advice suppression

Current safety limits:

- output guardrails are simple pattern checks
- non-food rejection is not strongly separated from meal extraction
- no human review or incident loop is wired in

## Recommended Model Choices By Stage

### Input guardrails

Current implementation:

- mostly deterministic
- unsafe screening uses the moderation API

Recommendation:

- keep deterministic validation local
- keep moderation on a dedicated moderation model
- if non-food precision/recall becomes a major issue, add a dedicated classifier or explicit vision triage stage

### Meal extraction

Current implementation:

- one structured multimodal call
- current default model in `.env.example`: `gpt-5.4-mini`

Recommendation:

- use a smaller cheaper multimodal model for:
  - MVP
  - internal demos
  - high-volume low-stakes traffic
- use a stronger multimodal model for:
  - ambiguous meals
  - dense multi-item meals
  - higher recall requirements

### Nutrition grounding

Current implementation:

- deterministic exact and alias matching
- embeddings fallback only on misses

Recommendation:

- keep this split
- do not replace it with another full generation call
- improve the KB before increasing model complexity

## Practical Guidance For Engineers

- If you need to cut cost first:
  - keep `gpt-5.4-mini`
  - tighten `MAX_OUTPUT_TOKENS`
  - improve exact and alias KB coverage to avoid embeddings fallback
- If you need to improve quality first:
  - strengthen the extraction prompt and schema
  - improve demo/golden datasets
  - consider a stronger extraction model before adding more orchestration
- If you need to improve safety first:
  - expand output policy tests
  - add stronger non-food and unsafe eval coverage
  - treat abstention rate as a tool, not a failure by default

## Presentation Notes

- Emphasize that the repo uses the model for perception, not for everything.
- Emphasize that nutrition is grounded locally.
- Emphasize that stronger models should only be justified where they materially improve extraction quality or reduce harmful overconfidence.
