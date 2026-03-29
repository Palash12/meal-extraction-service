#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

"${SCRIPT_DIR}/demo-success.sh"
"${SCRIPT_DIR}/demo-ambiguous.sh"
"${SCRIPT_DIR}/demo-input-rejection.sh"
"${SCRIPT_DIR}/demo-nonfood.sh"

printf '\n== Next Steps ==\n'
printf '%s\n' "Run scripts/demo/demo-model-compare.sh after restarting the app with and without INFERENCE_MODEL_OVERRIDE."
printf '%s\n' "Run scripts/demo/demo-token-cap.sh after restarting the app with and without MAX_OUTPUT_TOKENS."
printf '%s\n' "See docs/demo.md for optional upstream-failure and unsafe-rejection manual fallbacks."
