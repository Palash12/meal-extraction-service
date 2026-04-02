#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

for env_file in demo-report.env demo-voiceover.env demo-ui.env; do
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

printf '%s\n' "Start the browser at http://localhost:3000 after the app boots."
exec npm run dev
