#!/usr/bin/env bash

set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:3000}"
MEAL_ANALYSIS_PATH="${MEAL_ANALYSIS_PATH:-/v1/meals/analyze}"

banner() {
  printf '\n== %s ==\n' "$1"
}

note() {
  printf '%s\n' "$1"
}

require_env() {
  local name="$1"
  if [[ -z "${!name:-}" ]]; then
    printf 'Missing required environment variable: %s\n' "$name" >&2
    exit 1
  fi
}

make_request_id() {
  local prefix="$1"
  printf '%s-%s' "$prefix" "$(date +%s)"
}

post_meal_analysis() {
  local request_id="$1"
  local image_url="$2"
  local user_note="$3"
  local response_file
  response_file="$(mktemp)"
  local http_status

  http_status="$(
    curl --silent --show-error \
      -o "${response_file}" \
      -w '%{http_code}' \
      -X POST "${BASE_URL}${MEAL_ANALYSIS_PATH}" \
      -H 'content-type: application/json' \
      -d @- <<EOF
{
  "request_id": "${request_id}",
  "image_url": "${image_url}",
  "user_note": "${user_note}"
}
EOF
  )"

  cat "${response_file}"
  printf '\n'

  if [[ -n "${ARTIFACT_RESPONSE_FILE:-}" ]]; then
    cp "${response_file}" "${ARTIFACT_RESPONSE_FILE}"
  fi

  if [[ -n "${ARTIFACT_STATUS_FILE:-}" ]]; then
    printf '%s' "${http_status}" > "${ARTIFACT_STATUS_FILE}"
  fi

  rm -f "${response_file}"
}

post_raw_json() {
  local json_body="$1"
  local response_file
  response_file="$(mktemp)"
  local http_status

  http_status="$(
    curl --silent --show-error \
      -o "${response_file}" \
      -w '%{http_code}' \
      -X POST "${BASE_URL}${MEAL_ANALYSIS_PATH}" \
      -H 'content-type: application/json' \
      -d "${json_body}"
  )"

  cat "${response_file}"
  printf '\n'

  if [[ -n "${ARTIFACT_RESPONSE_FILE:-}" ]]; then
    cp "${response_file}" "${ARTIFACT_RESPONSE_FILE}"
  fi

  if [[ -n "${ARTIFACT_STATUS_FILE:-}" ]]; then
    printf '%s' "${http_status}" > "${ARTIFACT_STATUS_FILE}"
  fi

  rm -f "${response_file}"
}

print_log_hint() {
  local request_id="$1"
  note "Log hint: grep '${request_id}' your app logs."
}
