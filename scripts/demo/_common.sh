#!/usr/bin/env bash

set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:3000}"
MEAL_ANALYSIS_PATH="${MEAL_ANALYSIS_PATH:-/v1/meals/analyze}"
DEMO_STEP_DELAY_MS="${DEMO_STEP_DELAY_MS:-0}"
DEMO_INTERACTIVE="${DEMO_INTERACTIVE:-false}"

demo_bool_true() {
  local value
  value="$(printf '%s' "${1:-}" | tr '[:upper:]' '[:lower:]')"

  case "${value}" in
    1|true|yes|on)
      return 0
      ;;
    *)
      return 1
      ;;
  esac
}

demo_pause() {
  local prompt="${1:-Press Enter to continue...}"
  local delay_ms="${DEMO_STEP_DELAY_MS}"

  if demo_bool_true "${DEMO_INTERACTIVE}"; then
    if [[ -t 0 && -t 1 ]]; then
      printf '%s' "${prompt} "
      read -r _
      return
    fi
  fi

  if [[ "${delay_ms}" =~ ^[0-9]+$ ]] && (( delay_ms > 0 )); then
    local delay_seconds=$((delay_ms / 1000))
    local delay_remainder_ms=$((delay_ms % 1000))

    if (( delay_remainder_ms == 0 )); then
      sleep "${delay_seconds}"
      return
    fi

    if (( delay_seconds == 0 )); then
      sleep "0.$(printf '%03d' "${delay_remainder_ms}")"
      return
    fi

    sleep "${delay_seconds}.$(printf '%03d' "${delay_remainder_ms}")"
  fi
}

banner() {
  printf '\n== %s ==\n' "$1"
  demo_pause "Ready for the next step in ${1}."
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

  demo_pause "Sending request ${request_id}."

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
  demo_pause "Reviewing response for ${request_id}."

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

  demo_pause "Sending raw request body."

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
  demo_pause "Reviewing raw response."

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
  demo_pause "Checking log hint for ${request_id}."
  note "Log hint: grep '${request_id}' your app logs."
}
