# meal-extraction-service

TypeScript Express service that accepts a meal image URL and returns structured extraction fields from the OpenAI Responses API.

## Features

- `POST /v1/meals/extract`
- Strict request and response validation with Zod
- OpenAI Responses API integration with `store: false`
- Structured JSON logging
- Retry with exponential backoff for transient upstream failures
- Clear separation across controller, service, client, schema, and tests

## Project Structure

```text
src/
  app.ts
  server.ts
  config/
  controllers/
  routes/
  services/
  clients/
  schemas/
  middleware/
  lib/
  types/
tests/
  unit/
```

## Environment Variables

Copy `.env.example` into `.env` and set:

- `OPENAI_API_KEY`: OpenAI API key
- `OPENAI_MODEL`: Optional override, defaults to `gpt-5.4-mini`
- `OPENAI_MODERATION_MODEL`: Moderation model, defaults to `omni-moderation-latest`
- `PORT`: Local server port, defaults to `3000`
- `LOG_LEVEL`: Logging level label included in structured logs
- `DEMO_MODE`: Enables local demo observability and local-demo-only overrides
- `DECISION_LOGGING_ENABLED`: Adds richer structured decision logs in demo mode
- `ENABLE_UNSAFE_SCREENING`: Local-demo-only switch for unsafe screening, defaults to `true`
- `ENABLE_OUTPUT_GUARDRAILS`: Local-demo-only switch for output guardrails, defaults to `true`
- `FORCE_ABSTAIN_ON_LOW_CONFIDENCE`: Keeps low-confidence abstention on by default
- `INFERENCE_MODEL_OVERRIDE`: Local-demo-only inference model override
- `FETCH_TIMEOUT_MS`: Local-demo-only fetch timeout override
- `MAX_FETCH_SIZE_MB`: Local-demo-only fetch size override
- `MAX_OUTPUT_TOKENS`: Local-demo-only inference output token cap override

## Local Run

```bash
npm install
npm run dev
```

The service will start on `http://localhost:3000`.

## Build And Test

```bash
npm run typecheck
npm test
npm run build
```

## Demo Notes

- The public API does not expose internal timing, trace, or feature-flag state.
- Default runtime logs stay lean.
- Richer demo observability is available only when `DEMO_MODE=true`.
- Safety-weakening demo flags are local-demo-only, disabled from changing behavior unless you explicitly turn them on, and are not for production use.
- See [docs/demo.md](docs/demo.md) for the demo walkthrough and safe toggle guidance.

## API

### `POST /v1/meals/extract`

Request:

```json
{
  "image_url": "https://example.com/meal.jpg",
  "user_note": "Dinner with grilled salmon",
  "request_id": "req_123"
}
```

Response:

```json
{
  "dish_candidates": ["grilled salmon plate"],
  "visible_components": ["salmon fillet", "rice", "broccoli"],
  "portion_estimate": {
    "size": "medium",
    "confidence": "medium",
    "notes": "Single plated meal with moderate serving sizes"
  },
  "observed": ["Salmon fillet is visible", "Rice side is visible"],
  "assumed": ["Seasoning or oil may be present"],
  "unknown": ["Exact sauce ingredients"],
  "needs_user_confirmation": false,
  "clarifying_question": null
}
```

## Notes

- This service intentionally does not calculate nutrition values.
- No database is included yet.
- See `TODO` comments in the source for production auth, secrets handling, and rate limiting integration points.
