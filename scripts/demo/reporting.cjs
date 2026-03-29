function parseJson(value) {
  if (!value || !value.trim().startsWith("{")) {
    return null;
  }

  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function parseLogEntriesForRequest(logText, requestId) {
  return logText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map(parseJson)
    .filter((entry) => entry && entry.request_id === requestId)
    .map((entry) => ({
      event: entry.event ?? null,
      stage: entry.stage ?? null,
      outcome: entry.outcome ?? null,
      reason_code: entry.reason_code ?? null,
      confidence_level: entry.confidence_level ?? null,
      model_name: entry.model_name ?? null,
      latency_ms: entry.latency_ms ?? null,
      total_latency_ms: entry.total_latency_ms ?? null,
      input_tokens: entry.input_tokens ?? null,
      output_tokens: entry.output_tokens ?? null,
      estimated_cost_usd: entry.estimated_cost_usd ?? null,
    }));
}

function derivePerformance(entries) {
  const requestCompleted = entries.find((entry) => entry.event === "request_completed");
  const fetchStage = entries.find(
    (entry) => entry.event === "demo_stage_decision" && entry.stage === "image_fetch",
  );
  const unsafeStage =
    entries.find(
      (entry) => entry.event === "demo_model_call" && entry.stage === "unsafe_screening",
    ) ??
    entries.find(
      (entry) => entry.event === "demo_stage_decision" && entry.stage === "unsafe_screening",
    );
  const inferenceEntry =
    entries.find((entry) => entry.event === "demo_model_call" && entry.stage === "meal_inference") ??
    entries.find((entry) => entry.event === "demo_stage_decision" && entry.stage === "meal_inference");

  return {
    total_latency_ms: requestCompleted?.total_latency_ms ?? null,
    fetch_latency_ms: fetchStage?.latency_ms ?? null,
    unsafe_screening_latency_ms: unsafeStage?.latency_ms ?? null,
    meal_inference_latency_ms: inferenceEntry?.latency_ms ?? null,
    inference_model: inferenceEntry?.model_name ?? null,
    input_tokens: inferenceEntry?.input_tokens ?? null,
    output_tokens: inferenceEntry?.output_tokens ?? null,
    estimated_cost_usd: inferenceEntry?.estimated_cost_usd ?? null,
  };
}

function unavailablePerformance() {
  return {
    total_latency_ms: null,
    fetch_latency_ms: null,
    unsafe_screening_latency_ms: null,
    meal_inference_latency_ms: null,
    inference_model: null,
    input_tokens: null,
    output_tokens: null,
    estimated_cost_usd: null,
  };
}

function formatValue(value) {
  return value === null || value === undefined || value === "" ? "unavailable" : String(value);
}

function formatRunValue(runs, selector) {
  const values = runs.map((run) => formatValue(selector(run)));
  return values.length <= 1 ? values[0] : values.join(" -> ");
}

function formatRequestIds(runs) {
  const ids = runs.map((run) => run.requestId).filter(Boolean);
  return ids.length <= 1 ? ids[0] ?? "-" : ids.join(" / ");
}

function formatKeyResponseFields(responseBody) {
  if (responseBody?.error) {
    return `error.code=${responseBody.error.code}, retryable=${responseBody.error.retryable}`;
  }

  return [
    `status=${responseBody?.status ?? "-"}`,
    `confidence=${responseBody?.confidence ?? "-"}`,
    `abstained=${responseBody?.abstained ?? "-"}`,
    `reason=${responseBody?.reason ?? "-"}`,
    `clarifyingQuestion=${responseBody?.clarifyingQuestion ? "present" : "none"}`,
  ].join(", ");
}

function buildReport(results) {
  const lines = [
    "# Demo Report",
    "",
    `Generated: ${new Date().toISOString()}`,
    "",
    "## Summary",
    "",
    "| Scenario | Mode | Pass | HTTP/status | Total ms | Fetch ms | Unsafe ms | Inference ms | Model | Input tok | Output tok | Cost USD | Request ID |",
    "| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |",
    ...results.map(
      (result) =>
        `| ${result.name} | ${result.mode} | ${String(result.pass)} | ${result.summary.httpAndStatus} | ${formatRunValue(result.runs, (run) => run.performance.total_latency_ms)} | ${formatRunValue(result.runs, (run) => run.performance.fetch_latency_ms)} | ${formatRunValue(result.runs, (run) => run.performance.unsafe_screening_latency_ms)} | ${formatRunValue(result.runs, (run) => run.performance.meal_inference_latency_ms)} | ${formatRunValue(result.runs, (run) => run.performance.inference_model)} | ${formatRunValue(result.runs, (run) => run.performance.input_tokens)} | ${formatRunValue(result.runs, (run) => run.performance.output_tokens)} | ${formatRunValue(result.runs, (run) => run.performance.estimated_cost_usd)} | ${formatRequestIds(result.runs)} |`,
    ),
    "",
  ];

  for (const result of results) {
    lines.push(`## ${result.name}`);
    lines.push("");
    lines.push(`- Purpose: ${result.purpose}`);
    lines.push(`- Expected outcome: ${result.expectedOutcome}`);
    lines.push(`- Actual outcome: ${result.actualOutcome}`);
    lines.push(`- Pass/fail: ${result.pass}`);
    lines.push(`- Tradeoffs: ${result.tradeoffs.join(", ")}`);
    lines.push(`- Request ID: ${formatRequestIds(result.runs)}`);
    lines.push(`- Mode: ${result.mode}`);
    if (result.script) {
      lines.push(`- Script: \`${result.script}\``);
    }
    lines.push("");

    for (const run of result.runs) {
      lines.push(`### Run: ${run.label}`);
      lines.push("");
      lines.push(`- HTTP/status: ${run.httpStatus ?? "-"} / ${run.responseBody?.status ?? run.responseBody?.error?.code ?? "-"}`);
      lines.push(`- Request ID: ${run.requestId}`);
      if (run.imageUrl) {
        lines.push(`- Image URL: ${run.imageUrl}`);
      }
      lines.push(`- Performance:`);
      lines.push(`  - total latency: ${formatValue(run.performance.total_latency_ms)}`);
      lines.push(`  - fetch latency: ${formatValue(run.performance.fetch_latency_ms)}`);
      lines.push(`  - unsafe screening latency: ${formatValue(run.performance.unsafe_screening_latency_ms)}`);
      lines.push(`  - meal inference latency: ${formatValue(run.performance.meal_inference_latency_ms)}`);
      lines.push(`  - inference model: ${formatValue(run.performance.inference_model)}`);
      lines.push(`  - input tokens: ${formatValue(run.performance.input_tokens)}`);
      lines.push(`  - output tokens: ${formatValue(run.performance.output_tokens)}`);
      lines.push(`  - estimated cost usd: ${formatValue(run.performance.estimated_cost_usd)}`);
      lines.push(`- Key response fields:`);
      lines.push(`  - ${formatKeyResponseFields(run.responseBody)}`);
      lines.push(`- Key demo-log fields:`);
      if (run.logFields.entries.length > 0) {
        for (const entry of run.logFields.entries.slice(0, 8)) {
          lines.push(
            `  - event=${entry.event ?? "-"} stage=${entry.stage ?? "-"} outcome=${entry.outcome ?? "-"} reason=${entry.reason_code ?? "-"} model=${entry.model_name ?? "-"} latency_ms=${entry.latency_ms ?? "-"}`,
          );
        }
      } else {
        lines.push("  - no matching request-scoped log entries found");
      }
      lines.push("");
    }
  }

  return lines.join("\n");
}

module.exports = {
  buildReport,
  derivePerformance,
  formatValue,
  parseJson,
  parseLogEntriesForRequest,
  unavailablePerformance,
};
