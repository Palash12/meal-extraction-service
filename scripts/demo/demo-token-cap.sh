#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/_common.sh"

require_env DEMO_CLEAR_MEAL_URL

REQUEST_ID="${REQUEST_ID:-$(make_request_id demo-token-cap)}"

banner "Output Token Cap Comparison"
note "Run this script once with the baseline app config."
note "Then restart the app with DEMO_MODE=true and MAX_OUTPUT_TOKENS set, and run it again with the same DEMO_CLEAR_MEAL_URL."
note "Using request_id=${REQUEST_ID}"
post_meal_analysis "${REQUEST_ID}" "${DEMO_CLEAR_MEAL_URL}" "Demo token cap comparison on the same clear meal image. Focus on the main meal components only and ignore tiny garnish or scattered toppings that are not clearly separable."
print_log_hint "${REQUEST_ID}"
