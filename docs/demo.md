# Demo Guide

## Purpose

This guide describes the current demo workflow for the meal-analysis MVP. It reflects the existing implementation and the latest generated report artifacts. It does not propose behavior changes.

The demo is useful for showing tradeoffs between:

- accuracy and usefulness
- latency
- cost
- safety

## Runtime Shape

The request path used in the demo is:

1. local validation
2. bounded fetch from `image_url`
3. moderation-backed unsafe screening
4. one main meal inference call
5. local nutrition grounding
6. local output guardrails

## Prerequisites

- Node.js 20+
- `npm install`
- a valid `OPENAI_API_KEY`
- a local `.env` copied from `.env.example`

For individual shell scenario scripts:

- start the app separately with `npm run dev`

For the automated report flow:

- no separately running app is required
- `scripts/demo/run-demo-and-report.sh` starts managed local app instances itself
- optional local demo settings can be provided in `scripts/demo/demo-report.env`

## Required Environment Variables

Application env:

- `OPENAI_API_KEY`
- `OPENAI_MODEL`
- `OPENAI_MODERATION_MODEL`
- `PORT`
- `DEMO_MODE`
- `DECISION_LOGGING_ENABLED`
- `ENABLE_UNSAFE_SCREENING`
- `ENABLE_OUTPUT_GUARDRAILS`
- `FORCE_ABSTAIN_ON_LOW_CONFIDENCE`
- `INFERENCE_MODEL_OVERRIDE` for model comparison
- `MAX_OUTPUT_TOKENS` for token-cap comparison
- `DEMO_FORCE_UNSAFE_REJECTION` for the automated unsafe-rejection scenario
- `DEMO_FORCE_INFERENCE_FAILURE` for the automated upstream-failure scenario

Shell env for individual demo scripts:

- `BASE_URL`
- `DEMO_CLEAR_MEAL_URL`
- `DEMO_AMBIGUOUS_MEAL_URL`
- `DEMO_NONFOOD_IMAGE_URL`

Suggested public demo values:

```bash
export DEMO_CLEAR_MEAL_URL="https://upload.wikimedia.org/wikipedia/commons/5/5c/Fried_Rice%2C_Jollof_rice_and_salad%2C_served_with_Grilled_Chicken.jpg"
export DEMO_AMBIGUOUS_MEAL_URL="https://upload.wikimedia.org/wikipedia/commons/1/18/Fish_Curry_Rice_Plate_%2826138495975%29.jpg"
export DEMO_NONFOOD_IMAGE_URL="https://upload.wikimedia.org/wikipedia/commons/6/61/Laptop_on_a_desk.jpg"
```

## Local Start For Individual Scripts

```bash
cp .env.example .env
# fill in OPENAI_API_KEY and any local settings
npm install
npm run dev
```

Then:

```bash
export BASE_URL="${BASE_URL:-http://localhost:3000}"
```

For the browser UI demo:

1. open `http://localhost:3000`
2. click `Run demo`
3. capture the input panel, output panel, and trace panel as the scenarios complete

Recommended launch command:

```bash
bash scripts/demo/run-ui-demo.sh
```

## Scenario Scripts

Run individually:

```bash
scripts/demo/demo-success.sh
scripts/demo/demo-ambiguous.sh
scripts/demo/demo-input-rejection.sh
scripts/demo/demo-nonfood.sh
scripts/demo/demo-model-compare.sh
scripts/demo/demo-token-cap.sh
scripts/demo/demo-upstream-failure.sh
scripts/demo/demo-unsafe-rejection.sh
```

Run the baseline shell sequence:

```bash
scripts/demo/run-demo.sh
```

Run the automated scenario set and collect artifacts:

```bash
./scripts/demo/run-demo-and-report.sh
```

Fast mode:

```bash
bash scripts/demo/run-demo-and-report.sh
```

Run the three-scenario voiceover capture with live JSON output:

```bash
bash scripts/demo/run-voiceover-demo.sh
```

This automated capture runs only:

- clear meal -> successful analysis on `gpt-5.4-mini`
- non-food image -> fast abstention
- unsafe content -> blocked before inference

It also writes:

- `artifacts/demo/results.json`
- `artifacts/demo/report.md`

Slower presentation mode:

```bash
DEMO_STEP_DELAY_MS=1200 bash scripts/demo/run-voiceover-demo.sh
```

Interactive presentation mode:

```bash
DEMO_INTERACTIVE=true bash scripts/demo/run-voiceover-demo.sh
```

Notes:

- `DEMO_STEP_DELAY_MS` adds a pause between scenario labels, request execution, response display, and report summary lines.
- `DEMO_INTERACTIVE=true` pauses at the same checkpoints and waits for Enter when the terminal is interactive.
- You can combine them, but interactive mode takes precedence when a terminal is available.

## Current Automated Report Status

Source reviewed:

- `artifacts/demo/report.md`

Latest automated status snapshot:

- baseline success: pass
- ambiguous meal: pass
- input rejection: pass
- non-food image: pass
- upstream failure: pass
- unsafe rejection: pass
- model comparison: pass
- output token cap comparison: fail

## Scenario Notes

### Baseline Successful Meal Analysis

- Expected current outcome: `200 / ok`
- Current status in latest report: pass
- Shows the full path end to end with grounded nutrition output

### Ambiguous Meal

- Expected current outcome: `200 / abstained` or a clarifying question
- Current status in latest report: pass
- Useful for showing bounded uncertainty behavior

### Input Rejection

- Expected current outcome: `400 / VALIDATION_ERROR`
- Current status in latest report: pass
- Shows local validation rejecting bad input before moderation or inference

### Non-Food Image

- Expected current outcome: cautious behavior rather than deterministic rejection
- Current status in latest report: pass with `200 / abstained`
- This is still a limitation discussion point, not a guaranteed dedicated non-food rejection path

### Upstream Failure

- Expected current outcome: `502 / UPSTREAM_INFERENCE_FAILURE`
- Current status in latest report: pass
- Automated via `DEMO_FORCE_INFERENCE_FAILURE`

### Unsafe Content Rejection

- Expected current outcome: `400 / INPUT_REJECTED`
- Current status in latest report: pass
- Automated via `DEMO_FORCE_UNSAFE_REJECTION`
- In the browser UI, this scenario uses a request-scoped demo override header so the same page can run all three scenarios in one session

### Model Comparison

- Expected current outcome: two successful runs with different model names
- Current status in latest report: pass
- Latest report shows `gpt-5.4 -> gpt-5.4-mini` with lower latency and lower estimated cost on the override run

### Output Token Cap Comparison

- Intended outcome: two successful runs with different output-token usage
- Current status in latest report: fail
- Latest report shows:
  - default run: `200 / ok`
  - capped run: `502 / UPSTREAM_INFERENCE_FAILURE`
- Treat this as a current demo limitation. The docs should not claim this scenario is presentation-ready.

## Log Inspection

Useful events to inspect:

- `request_completed`
- `input_rejected`
- `unsafe_content_rejected`
- `output_guardrail_applied`
- `upstream_call_failed`
- `demo_feature_flags`
- `demo_stage_decision`
- `demo_model_call`
- `demo_inference_summary`
- `demo_request_outcome`
- `demo_tradeoff_snapshot`

## Known Caveats

- The automated report runner is now functional and writes fresh top-level artifacts.
- Exact food labels, uncertainty notes, and grounded nutrition notes remain model-dependent and can vary between runs.
- The token-cap comparison is still unstable with the current capped setting and can produce `UPSTREAM_INFERENCE_FAILURE`.
- Non-food handling is still best described as cautious abstention behavior rather than deterministic non-food rejection.

## Troubleshooting

- If an individual shell script fails, confirm the app is running and `BASE_URL` is correct.
- If the automated report runner fails, check `artifacts/demo/*/*.log` for the request-specific scenario logs.
- If request-scoped logs are missing from a scenario, inspect the corresponding log file under `artifacts/demo/<scenario>/`.
- If model comparison does not show a model change, confirm `scripts/demo/demo-report.env` is setting a valid `DEMO_COMPARE_MODEL_OVERRIDE`.
- If output-token-cap comparison is still failing, treat that as a known current limitation rather than a bad invocation.
