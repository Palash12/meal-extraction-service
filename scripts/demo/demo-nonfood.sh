#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/_common.sh"

REQUEST_ID="${REQUEST_ID:-$(make_request_id demo-nonfood)}"

banner "Non-Food Image"

if [[ -z "${DEMO_NONFOOD_IMAGE_URL:-}" ]]; then
  note "Manual fallback: set DEMO_NONFOOD_IMAGE_URL to a safe non-food image URL, then rerun this script."
  note "Current MVP does not guarantee deterministic non-food rejection, so use this as a limitation/abstention discussion point."
  exit 0
fi

note "Using DEMO_NONFOOD_IMAGE_URL with request_id=${REQUEST_ID}"
post_meal_analysis "${REQUEST_ID}" "${DEMO_NONFOOD_IMAGE_URL}" "Demo non-food image"
print_log_hint "${REQUEST_ID}"
