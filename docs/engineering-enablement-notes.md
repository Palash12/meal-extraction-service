# Engineering Enablement Notes

## Purpose

This document is designed to support engineering iteration on the current meal-analysis MVP. It combines:

- developer process and iteration guidance
- success metrics
- an evaluation flywheel built from the current repo assets

It explicitly separates:

- current implementation
- recommended production process

## Current Implementation

### Practical build-measure-improve loop already visible in the repo

The repo already suggests a healthy iteration pattern:

1. change a small stage or threshold
2. run unit and integration tests
3. run demo scenarios
4. inspect structured logs and the generated demo report
5. refine prompt, KB, thresholds, or feature flags

This loop is supported by:

- prompt file:
  - `src/prompts/mealInference/mealNutritionEstimate.v1.txt`
- deterministic business logic:
  - `src/pipeline/`
  - `src/services/nutritionGrounding/`
- tests:
  - `tests/unit/`
  - `tests/integration/`
- demo scripts:
  - `scripts/demo/`
- demo artifacts:
  - `artifacts/demo/results.json`
  - `artifacts/demo/report.md`

## Recommended Team Iteration Loop

### 1. Choose one lever at a time

Examples:

- prompt wording
- inference model
- `MAX_OUTPUT_TOKENS`
- low-confidence abstention policy
- KB alias coverage
- embedding thresholds

### 2. Run the smallest useful eval set

For the current repo, that means:

- targeted unit tests
- `tests/integration/mealAnalysisEndpoint.test.ts`
- `scripts/demo/run-demo-and-report.sh`

### 3. Inspect failures by stage

Look for whether the issue belongs to:

- input guardrails
- unsafe screening
- extraction quality
- KB match quality
- nutrition aggregation
- output guardrails

### 4. Update the right layer

- prompt issue: change the prompt or model schema
- naming issue: expand aliases in `nutritionKb.json`
- weak grounding issue: adjust thresholds or add KB entries
- output policy issue: change `enforceSafetyPolicy.ts`

### 5. Re-run and compare

Compare:

- final status
- confidence
- detected items
- grounding matches
- policy flags
- latency
- tokens
- estimated demo cost

## How Codex Can Help

## Current implementation support

The repo is already structured in a way that works well with Codex:

- prompts are in one file
- stages are separated
- tests are local and fast
- demo scripts are deterministic enough for iteration

## Recommended Codex usage

### Prompt prototyping

Use Codex to:

- propose prompt revisions
- tighten structured-output wording
- surface prompt/schema mismatches
- compare prompt versions before adopting them

### Writing eval scripts

Use Codex to:

- add batch replay scripts
- generate scorecards
- diff results across prompts, models, and thresholds

### Debugging model outputs

Use Codex to:

- inspect where a failure happened in the pipeline
- summarize logs by request ID
- trace whether a failure came from extraction, grounding, or output guardrails

### Architecture iteration

Use Codex to:

- propose the smallest architectural change that addresses a concrete failure mode
- avoid overengineering when a KB, schema, or threshold change is enough

### Test generation

Use Codex to:

- add unit tests for edge cases
- add adversarial policy tests
- turn demo scenarios into regression tests

## Recommended Team Workflow

### Current implementation

The repo currently supports a lightweight team workflow:

- code in TypeScript
- tests in Jest
- demo scripts for stakeholder-visible behavior

### Recommended production workflow

Recommendations:

- one PR per behavioral change
- require:
  - prompt diff review
  - test updates
  - golden-set eval comparison
  - rollout note for model or threshold changes
- keep a simple change log with:
  - model version
  - prompt version
  - KB version
  - output-guardrail threshold changes

## Success Metrics

The metrics below are intentionally split into MVP assumptions and production recommendations.

### Usefulness / accuracy

| Metric | Why it matters | Current repo support | Main levers |
|---|---|---|---|
| Visible item detection quality | Core user value starts with recognizing what is on the plate | Partially supported through tests and demo scenarios, not with a full labeled eval set | prompt, model choice, schema clarity |
| Correct KB grounding rate | Determines whether nutrition is grounded to the right canonical foods | Supported by unit tests for exact, alias, and embedding fallback | KB coverage, aliases, embedding thresholds |
| Abstention quality | Prevents overclaiming on ambiguous or ungroundable meals | Supported by output guardrails and integration tests | confidence behavior, `FORCE_ABSTAIN_ON_LOW_CONFIDENCE`, prompt wording |
| Nutrition estimate usefulness | Users need bounded estimates, not fake certainty | Supported structurally, not yet measured on a labeled corpus | portion estimates, KB quality, match quality |

Recommended targets:

- MVP:
  - visible-item F1 `>= 0.80`
  - exact-or-alias grounding rate on in-KB foods `>= 0.90`
- Production recommendation:
  - visible-item F1 `>= 0.90`
  - calorie median relative error `<= 10%` on fully groundable meals

### Latency

| Metric | Why it matters | Current repo support | Main levers |
|---|---|---|---|
| end-to-end latency | Determines user experience and operational headroom | Exposed in logs and demo reports | fetch limits, model choice, token cap |
| fetch latency | Controls early path responsiveness | Logged in demo mode | remote image host quality, timeouts |
| moderation latency | Adds safety cost before inference | Logged in demo mode | moderation model latency |
| inference latency | Main latency driver | Logged in demo mode | model strength, image complexity, output tokens |

Recommended targets:

- MVP:
  - p95 end-to-end under `5s`
- Production recommendation:
  - p95 end-to-end under `2.5s`

### Cost

| Metric | Why it matters | Current repo support | Main levers |
|---|---|---|---|
| input and output tokens | Main variable cost driver | Logged in demo mode for moderation and inference | model choice, prompt length, token cap |
| estimated cost per request | Helps compare tradeoffs live | Demo-only estimated cost is supported | model selection, retries, embeddings fallback |
| embedding fallback rate | Signals hidden retrieval cost and KB gaps | Not explicitly surfaced as a rate yet | alias coverage, KB breadth |

Recommended targets:

- MVP:
  - stable median cost within agreed demo budget
- Production recommendation:
  - per-request cost budget tied to SLA tier and usage tier

### Safety

| Metric | Why it matters | Current repo support | Main levers |
|---|---|---|---|
| unsafe rejection rate | Shows moderation behavior | Demo logs support it | moderation model, content mix |
| policy-block rate | Shows output guardrail activity | Demo logs support it | regex rules, prompt wording |
| low-confidence abstention rate | Shows bounded behavior under uncertainty | Supported in logs and final responses | prompt, model, `FORCE_ABSTAIN_ON_LOW_CONFIDENCE` |
| medical-advice leakage rate | Critical for trust and policy compliance | Not yet measured as a corpus-level metric | prompt, output patterns, eval coverage |

Recommended targets:

- MVP:
  - zero known medical-advice leaks in seeded evals
- Production recommendation:
  - medical-advice leakage under `0.5%` on red-team sets, ideally lower

### Availability

| Metric | Why it matters | Current repo support | Main levers |
|---|---|---|---|
| success rate | Measures end-user reliability | Stable error responses exist, but no real dashboard | upstream reliability, retries, timeouts |
| upstream failure rate | Identifies model or network instability | Logged as `upstream_call_failed` | model provider reliability, retry policy |
| timeout rate | Tracks fetch and inference pain points | Partially represented in errors and logs | fetch policy, network path, model latency |

Recommended targets:

- MVP:
  - clear stable failure handling
- Production recommendation:
  - `>= 99.9%` service availability with alerts and rollback paths

## Evaluation Flywheel

## Current implementation

The repo already has the beginnings of an eval flywheel:

- fixed demo scenarios
- structured logs
- generated comparison artifacts
- tests covering key branches

## How current demo scenarios can become a lightweight eval set

### Suggested golden dataset for this repo

Start with 8 to 12 cases:

- clear grilled chicken + rice + salad
- fish curry rice plate
- fried rice / jollof rice / grilled chicken
- salad bowl
- ambiguous meal
- non-food image
- invalid URL request
- unsafe image placeholder when policy-safe assets exist

For each case, record:

- expected status
- expected confidence band
- expected detected items
- expected acceptable KB matches
- expected abstention behavior
- expected policy flags

### Simple scorecard structure

Recommended columns:

- `case_id`
- `prompt_version`
- `model_name`
- `status`
- `confidence`
- `detected_items_ok`
- `grounding_ok`
- `nutrition_estimate_ok`
- `policy_ok`
- `latency_ms`
- `input_tokens`
- `output_tokens`
- `estimated_cost_usd`
- `review_notes`

### Recommended evolution path

1. demo scenarios become a checked-in golden set
2. golden set becomes a repeatable batch eval
3. batch eval becomes a PR gate for prompt/model changes
4. post-launch review samples feed new cases back into the golden set

## Presentation Notes

- The repo already demonstrates an engineering habit that is worth praising:
  - iterate with small levers
  - inspect by stage
  - keep safety local where possible
- The main missing piece is not “more AI.”
- The main missing piece is disciplined eval data and comparison workflows.
