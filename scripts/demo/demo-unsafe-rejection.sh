#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/_common.sh"

require_env DEMO_CLEAR_MEAL_URL

REQUEST_ID="${REQUEST_ID:-$(make_request_id demo-unsafe-rejection)}"

banner "Unsafe Content Rejection"
note "Using DEMO_CLEAR_MEAL_URL with request_id=${REQUEST_ID}"
note "This scenario expects the app to be started with DEMO_FORCE_UNSAFE_REJECTION=true in local demo mode."
post_meal_analysis "${REQUEST_ID}" "${DEMO_CLEAR_MEAL_URL}" "Demo unsafe screening rejection on a safe local placeholder image"
print_log_hint "${REQUEST_ID}"
