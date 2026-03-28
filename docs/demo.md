# Demo Plan

## Goal

Use the meal-analysis MVP to explain the tradeoffs between accuracy/usefulness, latency, cost, and safety without changing the public API.

## Safe Default

Start with:

```bash
DEMO_MODE=false
DECISION_LOGGING_ENABLED=false
ENABLE_UNSAFE_SCREENING=true
ENABLE_OUTPUT_GUARDRAILS=true
FORCE_ABSTAIN_ON_LOW_CONFIDENCE=true
```

This keeps the normal sparse logs and the safest behavior.

## Demo Mode

Turn on richer internal demo logs with:

```bash
DEMO_MODE=true
DECISION_LOGGING_ENABLED=true
```

This adds bounded structured logs for:

- active feature flags
- stage decisions
- model-call latency, tokens, and estimated cost
- inference summaries without raw model output
- request outcome and aggregate tradeoff snapshots

## Suggested Demo Sequence

1. Run with safe defaults and show the lean baseline logs.
2. Turn on `DEMO_MODE=true` and `DECISION_LOGGING_ENABLED=true` to show:
   - why a request was accepted, rejected, abstained, or blocked
   - which stage made the decision
   - where latency is spent
   - which model call drives token usage and estimated cost
3. Change `INFERENCE_MODEL_OVERRIDE` to compare behavior and cost/latency tradeoffs.
4. Lower `MAX_OUTPUT_TOKENS` to show cost and latency pressure on inference.
5. Lower `FETCH_TIMEOUT_MS` or `MAX_FETCH_SIZE_MB` to show stricter bounded fetch behavior.
6. Only if needed for the demo, temporarily set:
   - `ENABLE_UNSAFE_SCREENING=false`
   - `ENABLE_OUTPUT_GUARDRAILS=false`
   - `FORCE_ABSTAIN_ON_LOW_CONFIDENCE=false`

## Safety Warning

The following flags are local-demo-only and must stay at their safe defaults in production:

- `ENABLE_UNSAFE_SCREENING`
- `ENABLE_OUTPUT_GUARDRAILS`
- `FORCE_ABSTAIN_ON_LOW_CONFIDENCE`

Never recommend disabling them outside a controlled local demo.

## Redaction Rules

The demo logs intentionally do not include:

- raw images
- full image URLs
- raw user notes
- full prompts
- full model outputs
- secrets, auth headers, or API keys

## What To Point Out Live

- `input_guardrails`: fast local checks and bounded fetch reduce wasted latency/cost.
- `unsafe_screening`: moderation adds cost and latency but reduces safety risk.
- `meal_inference`: this is the main cost driver and usually the biggest latency contributor.
- `output_guardrails`: these preserve safety and can trade off against maximal usefulness by abstaining or blocking.
- `demo_tradeoff_snapshot`: use this to discuss how requests accumulate into abstention rate, unsafe rejection rate, policy block rate, call counts, tokens, and estimated cost.
