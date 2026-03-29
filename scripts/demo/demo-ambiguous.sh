#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/_common.sh"

require_env DEMO_AMBIGUOUS_MEAL_URL

REQUEST_ID="${REQUEST_ID:-$(make_request_id demo-ambiguous)}"

banner "Ambiguous Meal"
note "Using DEMO_AMBIGUOUS_MEAL_URL with request_id=${REQUEST_ID}"
post_meal_analysis "${REQUEST_ID}" "${DEMO_AMBIGUOUS_MEAL_URL}" "Demo ambiguous or partially obscured meal"
print_log_hint "${REQUEST_ID}"
