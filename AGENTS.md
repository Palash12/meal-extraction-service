# AGENTS.md

## Project purpose
This repository implements a backend MVP for an AI-powered meal analysis system for a health-tech mobile application.

Users upload meal images. The backend must:
1. validate the uploaded image
2. analyze the meal image and infer structured nutritional estimates
3. apply output safety checks before returning the result

This product provides nutritional estimates only. It must not provide medical advice.

---

## Source of truth
The current codebase uses:
- Node.js
- TypeScript
- Express
- Jest

Do not propose Python, FastAPI, Pydantic, or pytest unless explicitly asked to migrate the stack.

Keep the current scaffolding and build within it.

---

## Architecture rules
Use a deterministic backend pipeline with these logical stages:

1. `inputGuardrails`
2. `mealInference`
3. `outputGuardrails`
4. `orchestrator`

Do not convert this into:
- an autonomous multi-agent architecture
- a multi-service distributed system
- an overengineered framework-heavy workflow

Prefer a simple, modular, observable backend.

Each module should have one clear responsibility.

---

## Functional requirements
The system must support:

### Input guardrails
- validate file type and file size
- validate that the image is usable
- screen for non-food images
- screen for unsafe or disallowed content
- reject invalid inputs early when possible

### Meal inference
- analyze meal images with OpenAI models
- return structured nutritional estimates
- include confidence and uncertainty where appropriate
- distinguish visible evidence from inferred assumptions when possible

### Output guardrails
- prevent diagnosis, treatment, medication, or disease-specific advice
- prevent claims of medical safety for a user condition
- allow safe nutritional estimates and uncertainty language
- support abstention or clarification when confidence is low

### Orchestration
- run the stages in order
- stop early on rejected inputs
- return stable structured responses
- attach request IDs, timing, policy flags, and consistent errors

---

## Technical standards
- Language: TypeScript
- Runtime: Node.js
- Framework: Express
- Validation: Zod or equivalent runtime schema validation
- Testing: Jest
- Config: `.env` with a documented `.env.example`

General rules:
- use TypeScript types everywhere
- keep functions small and focused
- avoid deeply nested business logic in route handlers
- keep HTTP concerns separate from model logic
- prefer pure functions where practical
- add clear comments for safety-sensitive logic
- avoid hidden prompt strings inside unrelated files

---

## Project structure guidance
Keep the codebase organized around these responsibilities:

- `routes/` for HTTP request and response handling only
- `schemas/` for request, response, and error contracts
- `pipeline/` for the deterministic stage modules
- `clients/` for external API wrappers, including OpenAI
- `prompts/` for versioned prompt assets
- `services/` for config, logging, request context, and shared helpers
- `tests/` for unit and integration tests

Do not mix:
- prompt logic into route files
- OpenAI API calls across multiple unrelated modules
- policy enforcement directly into transport code

---

## OpenAI integration rules
All OpenAI API calls must go through a single shared client wrapper.

Requirements:
- centralize model configuration
- centralize retries and error handling
- centralize logging hooks for model calls
- make model swaps easy later
- keep prompt files versioned under `/prompts`

Use structured outputs with a stable schema where appropriate.
Prefer predictable machine-readable responses over free-form text.

Do not scatter OpenAI calls across the codebase.

---

## Safety and policy rules
Allowed behavior:
- identify visible food items
- estimate calories and macronutrients
- express uncertainty clearly
- ask follow-up clarification questions
- abstain when confidence is low

Disallowed behavior:
- diagnosis
- treatment recommendations
- medication advice
- disease-specific meal safety claims
- statements implying clinical certainty from a photo alone

If uncertain, prefer:
1. abstention
2. clarification
3. lower-confidence estimate with explicit caveats

Do not optimize for seeming confident.
Optimize for safe, bounded, explainable behavior.

---

## API behavior expectations
Responses should be stable and structured.

Prefer fields such as:
- `requestId`
- `status`
- `confidence`
- `detectedItems`
- `nutritionEstimate`
- `uncertaintyNotes`
- `clarifyingQuestion`
- `policyFlags`
- `abstained`
- `reason`

Do not add fields that imply medical judgment.

Error handling should clearly distinguish:
- invalid request
- rejected input
- upstream inference failure
- policy-blocked output

---

## Logging and observability
Every request should support a request ID.

Log at minimum:
- request ID
- stage-level timing
- validation outcomes
- confidence scores
- policy flags
- abstention decisions
- model call success or failure
- schema validation failures

Do not log:
- secrets
- API keys
- unnecessary sensitive content

Keep logs structured so they can support future evaluation and monitoring workflows.

---

## Testing requirements
When changing behavior, update tests.

Minimum coverage should include:
- invalid file rejection
- non-food image rejection
- unsafe-content rejection
- successful structured meal analysis
- low-confidence fallback or abstention
- medical-advice blocking
- orchestrator stage sequencing
- schema validation for successful and failed responses

Mock external model calls in unit tests.

Add integration-style tests for the endpoint once the pipeline is connected.

---

## Prompt management
Store prompts in versioned files under `/prompts`.

Guidelines:
- one prompt file per major task or stage when practical
- do not bury prompts inside route handlers
- comment any prompt logic tied to safety or policy
- make prompt revisions easy to compare
- keep prompt names explicit, such as `mealInference/v1.txt`

Prompts are part of the system logic and should be treated as reviewable assets.

---

## Documentation requirements
Update `README.md` whenever any of the following changes:
- architecture
- API contract
- environment variables
- model integration flow
- testing workflow
- setup instructions

Document:
- assumptions
- tradeoffs
- known limitations
- how abstention and policy blocking work

---

## Preferred workflow for Codex
For non-trivial changes:
1. inspect the current repo
2. read `AGENTS.md`
3. propose a plan first
4. implement in small reviewable steps
5. add or update tests
6. update docs if behavior changed

Do not jump into large-scale implementation without first checking whether the repo structure and requirements still align.

For this project, favor correctness, safety, clarity, and maintainability over cleverness.