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
- `PORT`: Local server port, defaults to `3000`
- `LOG_LEVEL`: Logging level label included in structured logs

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
