#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/_common.sh"

require_env DEMO_CLEAR_MEAL_URL

REQUEST_ID="${REQUEST_ID:-$(make_request_id demo-success)}"

banner "Baseline Successful Meal Analysis"
note "Using DEMO_CLEAR_MEAL_URL with request_id=${REQUEST_ID}"
post_meal_analysis "${REQUEST_ID}" "${DEMO_CLEAR_MEAL_URL}" "Demo baseline clear plated meal. Focus on the main meal components only and ignore tiny garnish or scattered toppings that are not clearly separable."
print_log_hint "${REQUEST_ID}"
