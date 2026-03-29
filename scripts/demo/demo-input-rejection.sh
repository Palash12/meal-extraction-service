#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/_common.sh"

REQUEST_ID="${REQUEST_ID:-$(make_request_id demo-input-rejection)}"

banner "Input Rejection"
note "Sending an invalid image_url to trigger local validation with request_id=${REQUEST_ID}"
post_raw_json "{\"request_id\":\"${REQUEST_ID}\",\"image_url\":\"not-a-url\"}"
print_log_hint "${REQUEST_ID}"
