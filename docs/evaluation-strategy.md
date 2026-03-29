# Evaluation Strategy

## Scope

This document covers:

- pre-production evaluation
- post-launch monitoring
- regression detection
- canary checks
- human review loops

It also distinguishes between what the repo supports today and what should be added for a stronger production rollout.

## Current Implementation

### What exists today

The repo already provides a useful starting point for evals:

- unit tests for:
  - input guardrails
  - normalization
  - output guardrails
  - nutrition grounding
  - OpenAI client behavior
- integration test for `POST /v1/meals/analyze`
- demo scripts for repeatable scenario runs
- a demo report generator that produces:
  - `artifacts/demo/results.json`
  - `artifacts/demo/report.md`

Relevant files:

- `tests/integration/mealAnalysisEndpoint.test.ts`
- `tests/unit/nutritionGrounding.test.ts`
- `tests/unit/enforceSafetyPolicy.test.ts`
- `scripts/demo/run-demo-and-report.sh`
- `scripts/demo/generate-demo-report.mjs`

### What is missing today

- a durable labeled eval dataset in the repo
- automated offline scoring beyond Jest expectations
- threshold-based regression gates in CI
- production dashboards and alerts
- human review queue and escalation workflow

## Recommended Pre-Production Evaluation Design

## 1. Input guardrails

### What to evaluate

- request validation precision and recall
- URL safety handling
- fetch timeout behavior
- content-type rejection precision
- unusable-image rejection precision
- unsafe-screening precision and recall

### Suggested dataset

Create a small labeled set with:

- valid food images
- valid non-food images
- invalid URLs
- unsupported content types
- oversized payload cases
- empty or tiny images
- safe but visually ambiguous meals
- unsafe/disallowed images, if policy-safe internal assets exist

### Suggested labels

- `should_accept_local`
- `should_reject_local`
- `local_rejection_reason`
- `should_block_unsafe`
- `should_continue_to_inference`

### Recommended thresholds

Recommendations:

- local validation precision: `>= 0.99`
- local validation recall on malformed requests: `>= 0.99`
- unsafe-screening recall on disallowed content: `>= 0.99`
- unsafe-screening false positive rate on safe meal images: `<= 0.02`

### Current support in repo

- good unit-test support for local logic
- no labeled batch eval runner yet

## 2. Meal extraction quality

### What to evaluate

- food item detection quality
- visible vs inferred evidence quality
- confidence calibration quality
- abstention / clarification behavior
- portion estimate usefulness

### Suggested labels

For each image:

- visible food items
- optionally inferred food items
- whether the image is clearly a meal
- expected confidence band
- whether abstention is appropriate
- acceptable clarifying question or `none`

### Recommended metrics

Recommendations:

- visible-item precision / recall / F1
- inferred-item precision / recall / F1
- abstention precision
- clarification usefulness rate
- confidence calibration buckets

### Suggested thresholds

Recommendations:

- visible-item F1: `>= 0.80` for MVP, `>= 0.90` for production target
- inappropriate abstention rate on clear meals: `<= 0.10`
- inappropriate confident acceptance on ambiguous meals: `<= 0.05`

### Current support in repo

- integration tests cover success and abstention paths
- demo scenarios cover baseline and ambiguous cases
- no batch extraction scorecard yet

## 3. Nutrition estimate quality

### What to evaluate

The current system does not claim exact nutritional truth from an image alone. Evaluate it accordingly:

- correct grounding to KB entries
- sensible uncertainty ranges
- reasonable aggregate totals for matchable meals
- correct abstention when grounding is weak or impossible

### Suggested labels

For each golden image:

- canonical food entries expected
- acceptable aliases
- approximate portion band
- target nutrition ranges
- whether the meal is fully, partially, or not groundable from the KB

### Recommended metrics

Recommendations:

- canonical match accuracy
- alias match accuracy
- embedding fallback correctness
- meal-level calorie relative error
- macro relative error
- percent of meals that should abstain and do abstain

### Suggested thresholds

Recommendations:

- exact or alias match rate on in-KB foods: `>= 0.90`
- wrong-canonical-match rate on embedding fallback: `<= 0.10`
- median calorie relative error on fully matchable meals: `<= 20%` for MVP
- nutrition abstention precision on ungroundable meals: `>= 0.90`

### Current support in repo

- strong unit tests for:
  - exact match
  - alias match
  - embedding fallback
  - weak-match uncertainty propagation
  - successful grounded estimate

## 4. Output safety and medical-advice suppression

### What to evaluate

- whether clarifying questions or model-derived text trigger medical-advice blocking correctly
- whether low-confidence abstention fires when expected
- whether safe outputs are not unnecessarily blocked

### Suggested labels

- `contains_medical_advice_like_content`
- `should_abstain_low_confidence`
- `should_pass_output_guardrails`
- `expected_policy_flags`

### Recommended metrics

Recommendations:

- policy-block precision
- policy-block recall on known disallowed phrasing
- false positive block rate
- low-confidence abstention precision

### Suggested thresholds

Recommendations:

- medical-advice suppression recall: `>= 0.99` on seeded bad prompts
- false positive block rate on safe clarification: `<= 0.02`
- low-confidence abstention precision: `>= 0.90`

### Current support in repo

- unit tests in `tests/unit/enforceSafetyPolicy.test.ts`
- no seeded corpus of adversarial phrasing yet

## Regression Evals

### Current implementation

The current repo supports regression-style checks through:

- unit tests
- integration tests
- demo scripts
- generated demo report artifacts

### Recommended next step

Add a small golden eval runner that:

- replays a fixed image set
- stores expected outcomes in JSON
- records:
  - final status
  - policy flags
  - detected items
  - matched KB entries
  - latency and token use if available

This should be run when any of these change:

- prompt text
- model version
- output token cap
- nutrition KB
- output-guardrail thresholds

## Canary Checks And Post-Launch Monitoring

## Current implementation

Current monitoring support is demo-oriented:

- `request_completed`
- `input_rejected`
- `unsafe_content_rejected`
- `output_guardrail_applied`
- `upstream_call_failed`
- demo-mode stage and model-call logs

### Recommended production monitoring

Recommendations:

- request count and success rate
- p50/p95/p99 latency
- moderation call count
- inference call count
- embedding fallback rate
- abstention rate
- input rejection rate
- unsafe rejection rate
- output policy-block rate
- upstream failure rate
- token usage by stage
- estimated cost by request and by stage

### Recommended alerts

Recommendations:

- sudden increase in `UPSTREAM_INFERENCE_FAILURE`
- p95 latency regression beyond agreed threshold
- abstention spike on previously stable golden-set scenarios
- embedding fallback rate spike
- unsafe rejection spike on normally safe traffic

## Human Review Loop

### Recommended process

Recommendations:

- sample low-confidence accepted results weekly
- sample abstentions weekly
- sample embedding-based matches weekly
- sample all policy-blocked outputs
- tag issues by root cause:
  - prompt
  - model
  - KB coverage
  - portioning
  - output guardrail
  - moderation false positive

That loop should feed:

- KB updates
- prompt revisions
- threshold changes
- regression dataset growth

## Suggested Eval Dataset Structure

Recommendations:

- `evals/images/`
- `evals/cases.jsonl`

Suggested fields per case:

- `case_id`
- `image_url` or local asset reference
- `scenario_type`
- `is_food_image`
- `is_safe_image`
- `expected_status`
- `expected_detected_items`
- `expected_aliases`
- `expected_kb_matches`
- `expected_policy_flags`
- `expected_abstained`
- `acceptable_clarifying_question`

## Presentation Notes

- Tell the audience that the repo already demonstrates good engineering instincts:
  - deterministic stages
  - local guardrails
  - stable tests
  - demo report artifacts
- Also tell them plainly that production eval maturity still needs:
  - labeled data
  - automated scoring
  - regression gates
  - human-review loops
