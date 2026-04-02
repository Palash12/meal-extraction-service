#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

for env_file in demo-report.env demo-voiceover.env; do
  if [[ -f "${SCRIPT_DIR}/${env_file}" ]]; then
    set -a
    # shellcheck disable=SC1091
    source "${SCRIPT_DIR}/${env_file}"
    set +a
  fi
done

export OPENAI_MODEL="${OPENAI_MODEL:-gpt-5.4-mini}"
export DEMO_MODE="${DEMO_MODE:-true}"
export DECISION_LOGGING_ENABLED="${DECISION_LOGGING_ENABLED:-true}"
export ENABLE_UNSAFE_SCREENING="${ENABLE_UNSAFE_SCREENING:-true}"
export ENABLE_OUTPUT_GUARDRAILS="${ENABLE_OUTPUT_GUARDRAILS:-true}"
export FORCE_ABSTAIN_ON_LOW_CONFIDENCE="${FORCE_ABSTAIN_ON_LOW_CONFIDENCE:-true}"
export DEMO_REPORT_SCENARIO_SET="${DEMO_REPORT_SCENARIO_SET:-voiceover}"
export DEMO_EMIT_SCRIPT_OUTPUT="${DEMO_EMIT_SCRIPT_OUTPUT:-true}"
export DEMO_STEP_DELAY_MS="${DEMO_STEP_DELAY_MS:-1200}"
export DEMO_INTERACTIVE="${DEMO_INTERACTIVE:-false}"
export DEMO_CLEAR_MEAL_URL="${DEMO_CLEAR_MEAL_URL:-https://upload.wikimedia.org/wikipedia/commons/5/5c/Fried_Rice%2C_Jollof_rice_and_salad%2C_served_with_Grilled_Chicken.jpg}"
export DEMO_NONFOOD_IMAGE_URL="${DEMO_NONFOOD_IMAGE_URL:-https://upload.wikimedia.org/wikipedia/commons/6/61/Laptop_on_a_desk.jpg}"

node "${SCRIPT_DIR}/generate-demo-report.mjs"
