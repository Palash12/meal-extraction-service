# Slide Support

## Purpose

This document is meant to help you present the current implementation honestly and clearly.

It covers:

- live demo guidance
- tradeoff walkthrough
- presentation guardrails
- likely reviewer questions
- artifacts worth showing on slides

## Demo And Tradeoff Walkthrough

## Current implementation

The repo already supports demo mode through:

- `DEMO_MODE`
- `DECISION_LOGGING_ENABLED`
- `ENABLE_UNSAFE_SCREENING`
- `ENABLE_OUTPUT_GUARDRAILS`
- `FORCE_ABSTAIN_ON_LOW_CONFIDENCE`
- `INFERENCE_MODEL_OVERRIDE`
- `FETCH_TIMEOUT_MS`
- `MAX_FETCH_SIZE_MB`
- `MAX_OUTPUT_TOKENS`

These are defined in:

- `src/config/env.ts`
- `src/services/config/featureFlags.ts`
- `.env.example`

### Safe defaults in the repo

Safe baseline defaults are:

- `DEMO_MODE=false`
- `DECISION_LOGGING_ENABLED=false`
- `ENABLE_UNSAFE_SCREENING=true`
- `ENABLE_OUTPUT_GUARDRAILS=true`
- `FORCE_ABSTAIN_ON_LOW_CONFIDENCE=true`

### Local-demo-only toggles

These are local-demo-only behavior levers:

- `ENABLE_UNSAFE_SCREENING`
- `ENABLE_OUTPUT_GUARDRAILS`
- `FORCE_ABSTAIN_ON_LOW_CONFIDENCE`
- `INFERENCE_MODEL_OVERRIDE`
- `FETCH_TIMEOUT_MS`
- `MAX_FETCH_SIZE_MB`
- `MAX_OUTPUT_TOKENS`

## What each toggle demonstrates

| Toggle | What it demonstrates | Main tradeoff |
|---|---|---|
| `ENABLE_UNSAFE_SCREENING` | moderation-backed early blocking before inference | safety vs latency/cost |
| `ENABLE_OUTPUT_GUARDRAILS` | how much safety is enforced after model output | safety vs raw usefulness |
| `FORCE_ABSTAIN_ON_LOW_CONFIDENCE` | whether low-confidence results are allowed through | usefulness vs safety |
| `INFERENCE_MODEL_OVERRIDE` | stronger vs cheaper extraction model behavior | accuracy vs latency/cost |
| `MAX_OUTPUT_TOKENS` | token and latency control | cost/latency vs answer richness |
| `FETCH_TIMEOUT_MS` | strictness of external image fetch budget | latency protection vs robustness to slow hosts |
| `MAX_FETCH_SIZE_MB` | acceptance envelope for large images | cost/latency/safety vs coverage |

## Recommended Live Demo Sequence

### 1. Baseline success

Run:

- `scripts/demo/demo-success.sh`

What it proves:

- full happy-path flow
- one moderation call
- one extraction call
- local grounding
- local output guardrails

What to show:

- response JSON
- `demo_stage_decision`
- `demo_model_call`
- `request_completed`

### 2. Ambiguous meal

Run:

- `scripts/demo/demo-ambiguous.sh`

What it proves:

- uncertainty handling
- abstention or clarification behavior
- the system is not optimized to sound certain

What to show:

- `status`
- `confidence`
- `uncertaintyNotes`
- `clarifyingQuestion`
- `output_guardrail_applied` if it fires

### 3. Input rejection

Run:

- `scripts/demo/demo-input-rejection.sh`

What it proves:

- cheap early rejection
- clear stable error contract
- expensive model work avoided

What to show:

- `VALIDATION_ERROR`
- lack of downstream model-call logs

### 4. Non-food image

Run:

- `scripts/demo/demo-nonfood.sh`

What it proves:

- current MVP limitation
- the system may abstain or behave cautiously, not deterministically reject

What to show:

- the actual observed outcome
- the explanation that this is an open eval and design area

### 5. Model comparison

Run:

- `scripts/demo/demo-model-compare.sh`

What it proves:

- same image, different model choice
- compare latency, tokens, cost, and behavior

What to show:

- `model_name`
- latency
- token counts
- estimated cost

### 6. Token-cap comparison

Run:

- `scripts/demo/demo-token-cap.sh`

What it proves:

- how output-token controls affect latency and cost
- whether the extraction remains useful under tighter budgets

What to show:

- input/output tokens
- cost deltas
- any behavior differences

## Best Live Artifacts To Show

- `artifacts/demo/report.md`
- `artifacts/demo/results.json`
- request-scoped logs grepped by `request_id`
- one successful response
- one abstained response
- one rejected input response

## Presentation Guardrails

## Functionally implemented today

- stable `POST /v1/meals/analyze` endpoint
- request validation and bounded fetch
- moderation-backed unsafe screening
- one structured extraction model call
- local nutrition grounding against a repo-local KB
- local output guardrails
- stable success and error responses
- demo-mode logging and report artifacts

## Demo-ready today

- happy-path success
- ambiguous / abstention behavior
- input rejection
- non-food limitation discussion
- model override discussion
- token-cap discussion

## Production-minded but not fully hardened

- request IDs
- structured logs
- deterministic stages
- strict schemas
- local grounding
- integration tests

## Future recommendations

- stronger non-food handling
- durable eval datasets
- production metrics and tracing backend
- canary rollout controls
- auth, rate limiting, abuse controls
- more complete nutrition KB and provenance

## What you should not claim

- Do not claim exact nutritional truth from a single image.
- Do not claim clinical or medical-grade correctness.
- Do not claim production hardening for security, auth, or compliance.
- Do not claim that non-food rejection is already deterministic.
- Do not claim that the current regex-based output guardrail is a complete medical policy layer.

## What this repository already demonstrates well

- good stage separation
- disciplined use of structured outputs
- a strong instinct to move nutrition calculation into deterministic local logic
- practical abstention behavior
- lightweight but useful demo observability

## Gaps To Call Out Clearly

- observability is demo-oriented, not production-grade
- no persistent eval corpus in the repo
- no database-backed or provenance-rich nutrition source
- no request auth or rate limiting
- non-food handling is still a weak point

## Risks, Assumptions, And Technical Debt

- nutrition quality depends heavily on KB coverage
- portion estimates still depend on model judgment
- embeddings fallback may produce semantically plausible but wrong matches
- legacy `/v1/meals/extract` path remains in the app and can distract from the main MVP story
- some observability interfaces are declared more broadly than they are wired in practice

## Questions Reviewers Are Likely To Ask

### “Why not let the model estimate nutrition directly?”

Suggested answer:

“Because the repo is intentionally trying to reduce unconstrained model reasoning. The model extracts visible meal structure once, and nutrition is grounded locally against a trusted KB so the final estimate is cheaper, more explainable, and easier to test.”

### “Why use embeddings at all?”

Suggested answer:

“Only as a narrow fallback when exact and alias matching fail. It is not a second synthesis step. It is a retrieval assist for KB matching.”

### “Can it reliably reject non-food images today?”

Suggested answer:

“Not deterministically in the current MVP. The system can abstain or behave cautiously, but stronger non-food evaluation and handling are still a recommendation rather than a completed feature.”

### “How production-ready is this?”

Suggested answer:

“The core request path is production-minded, but the surrounding operational hardening is not complete yet. The next major investments would be eval maturity, observability, and API protection.”

## Recommended Slide Artifacts

- architecture diagram from `docs/architecture-review.md`
- request-flow diagram from `docs/architecture-review.md`
- model tradeoff table from `docs/model-tradeoffs.md`
- one screenshot of `artifacts/demo/report.md`
- one request-scoped log example showing stage flow
- one integration test excerpt proving stable behavior

## Where Test Data Would Strengthen The Presentation Most

- a small labeled non-food dataset
- a small labeled unsafe-image dataset, if policy-safe
- a golden meal set with expected canonical KB matches
- a low-confidence red-team set for abstention and clarification behavior
