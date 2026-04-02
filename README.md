# meal-extraction-service

TypeScript Express service that accepts a meal image URL, performs structured meal analysis with the OpenAI Responses API, and grounds nutrition estimates against a trusted local nutrition KB.

## Features

- `POST /v1/meals/analyze`
- Strict request and response validation with Zod
- OpenAI Responses API integration with `store: false`
- Local nutrition grounding against `src/data/nutritionKb.json`
- Structured JSON logging and demo observability
- Retry with exponential backoff for transient upstream failures
- Automated demo runner that generates `artifacts/demo/results.json` and `artifacts/demo/report.md`

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
  prompts/
  schemas/
  middleware/
  lib/
  types/
tests/
  unit/
  integration/
scripts/
  demo/
docs/
```

## Environment Variables

Copy `.env.example` into `.env` and set:

- `OPENAI_API_KEY`: OpenAI API key
- `OPENAI_MODEL`: Inference model
- `OPENAI_MODERATION_MODEL`: Moderation model
- `PORT`: Local server port, defaults to `3000`
- `LOG_LEVEL`: Logging level label included in structured logs
- `DEMO_MODE`: Enables local demo observability and local-demo-only overrides
- `DECISION_LOGGING_ENABLED`: Adds richer structured decision logs in demo mode
- `ENABLE_UNSAFE_SCREENING`: Local-demo-only switch for unsafe screening
- `ENABLE_OUTPUT_GUARDRAILS`: Local-demo-only switch for output guardrails
- `FORCE_ABSTAIN_ON_LOW_CONFIDENCE`: Keeps low-confidence abstention on by default
- `INFERENCE_MODEL_OVERRIDE`: Local-demo-only inference model override
- `FETCH_TIMEOUT_MS`: Local-demo-only fetch timeout override
- `MAX_FETCH_SIZE_MB`: Local-demo-only fetch size override
- `MAX_OUTPUT_TOKENS`: Local-demo-only inference output token cap override
- `DEMO_FORCE_UNSAFE_REJECTION`: Local-demo-only forced unsafe rejection
- `DEMO_FORCE_INFERENCE_FAILURE`: Local-demo-only forced inference failure

## Local Run

```bash
npm install
npm run dev
```

The service starts on `http://localhost:3000`.

## Build And Test

```bash
npm run typecheck
npm test
npm run build
```

## Demo

For the UI demo, start the app and open `http://localhost:3000`:

```bash
bash scripts/demo/run-ui-demo.sh
```

Then click `Run demo` in the browser. The page logs the request JSON, response JSON, and short trace for:

- clear meal success
- non-food abstention
- unsafe-content rejection

For the terminal-only fallback, run the automated scenario set and collect artifacts:

```bash
./scripts/demo/run-demo-and-report.sh
```

For the 30-second voiceover capture, run the three canonical automated scenarios in sequence and stream their JSON output live:

```bash
bash scripts/demo/run-voiceover-demo.sh
```

This also writes:

- `artifacts/demo/results.json`
- `artifacts/demo/report.md`

The generated report compares:

- total latency
- fetch latency
- unsafe-screening latency
- meal-inference latency
- inference model
- input and output tokens
- estimated cost in USD when available from demo-mode logs

## API

### `POST /v1/meals/analyze`

Request:

```json
{
  "image_url": "https://example.com/meal.jpg",
  "user_note": "Dinner with grilled salmon",
  "request_id": "req_123"
}
```

Response example:

```json
{
  "requestId": "req_123",
  "status": "ok",
  "confidence": "high",
  "detectedItems": [
    {
      "name": "fried chicken drumsticks",
      "evidence": "visible",
      "confidence": "high"
    },
    {
      "name": "yellow rice",
      "evidence": "visible",
      "confidence": "high"
    }
  ],
  "nutritionEstimate": {
    "calories": { "lower": 623.6, "upper": 1040.4 },
    "protein_g": { "lower": 24.0, "upper": 37.6 },
    "carbs_g": { "lower": 80.0, "upper": 142.4 },
    "fat_g": { "lower": 23.2, "upper": 36.0 }
  },
  "uncertaintyNotes": [
    "Rice appears to be served in two distinct varieties but exact preparation is unknown."
  ],
  "clarifyingQuestion": null,
  "policyFlags": [],
  "abstained": false,
  "reason": null
}
```

## Notes

- Nutrition estimates are grounded locally against `src/data/nutritionKb.json`; no database is required.
- The meal-analysis path is: validation, bounded fetch, unsafe screening, one extraction call, local nutrition grounding, then local output guardrails.
- Based on the latest generated report in `artifacts/demo/report.md`, the automated demo runner completes end to end and writes fresh artifacts.
- The latest report also shows one known demo caveat: the output-token-cap comparison still fails in the capped run with `UPSTREAM_INFERENCE_FAILURE`, so that scenario is not yet presentation-clean.
- See [docs/demo.md](docs/demo.md) for current demo setup, scenario expectations, and report caveats.
