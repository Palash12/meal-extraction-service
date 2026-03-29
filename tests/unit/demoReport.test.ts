const {
  buildReport,
  derivePerformance,
  parseLogEntriesForRequest,
} = require("../../scripts/demo/reporting.cjs");

describe("demo report helpers", () => {
  it("parses request-scoped logs and derives performance fields", () => {
    const logText = [
      JSON.stringify({
        event: "demo_stage_decision",
        request_id: "req_1",
        stage: "image_fetch",
        latency_ms: 120,
      }),
      JSON.stringify({
        event: "demo_model_call",
        request_id: "req_1",
        stage: "unsafe_screening",
        model_name: "omni-moderation-latest",
        latency_ms: 210,
      }),
      JSON.stringify({
        event: "demo_model_call",
        request_id: "req_1",
        stage: "meal_inference",
        model_name: "gpt-5.4-mini",
        latency_ms: 800,
        input_tokens: 321,
        output_tokens: 87,
        estimated_cost_usd: 0.0005,
      }),
      JSON.stringify({
        event: "request_completed",
        request_id: "req_1",
        total_latency_ms: 1250,
      }),
    ].join("\n");

    const entries = parseLogEntriesForRequest(logText, "req_1");

    expect(derivePerformance(entries)).toEqual({
      total_latency_ms: 1250,
      fetch_latency_ms: 120,
      unsafe_screening_latency_ms: 210,
      meal_inference_latency_ms: 800,
      inference_model: "gpt-5.4-mini",
      input_tokens: 321,
      output_tokens: 87,
      estimated_cost_usd: 0.0005,
    });
  });

  it("renders automated comparison scenarios without manual-fallback labels", () => {
    const report = buildReport([
      {
        key: "model-compare",
        name: "Model Comparison",
        purpose: "Compare models on the same clear meal image.",
        tradeoffs: ["accuracy/usefulness", "latency", "cost"],
        expectedOutcome: "Two runs with distinct models.",
        actualOutcome: "baseline: HTTP 200 / ok; override: HTTP 200 / ok",
        pass: "pass",
        mode: "automated",
        script: "scripts/demo/demo-model-compare.sh",
        summary: {
          httpAndStatus: "200 / ok -> 200 / ok",
        },
        runs: [
          {
            label: "baseline",
            requestId: "req_base",
            httpStatus: 200,
            responseBody: { status: "ok", abstained: false, reason: null },
            performance: {
              total_latency_ms: 1500,
              fetch_latency_ms: 100,
              unsafe_screening_latency_ms: 200,
              meal_inference_latency_ms: 900,
              inference_model: "gpt-5.4-mini",
              input_tokens: 300,
              output_tokens: 80,
              estimated_cost_usd: 0.0004,
            },
            logFields: {
              entries: [
                {
                  event: "demo_model_call",
                  stage: "meal_inference",
                  outcome: "completed",
                  reason_code: null,
                  model_name: "gpt-5.4-mini",
                  latency_ms: 900,
                },
              ],
            },
          },
          {
            label: "override",
            requestId: "req_override",
            httpStatus: 200,
            responseBody: { status: "ok", abstained: false, reason: null },
            performance: {
              total_latency_ms: 1700,
              fetch_latency_ms: 110,
              unsafe_screening_latency_ms: 210,
              meal_inference_latency_ms: 980,
              inference_model: "gpt-5.4",
              input_tokens: 360,
              output_tokens: 95,
              estimated_cost_usd: 0.0011,
            },
            logFields: {
              entries: [
                {
                  event: "demo_model_call",
                  stage: "meal_inference",
                  outcome: "completed",
                  reason_code: null,
                  model_name: "gpt-5.4",
                  latency_ms: 980,
                },
              ],
            },
          },
        ],
      },
    ]);

    expect(report).toContain("| Model Comparison | automated | pass | 200 / ok -> 200 / ok |");
    expect(report).toContain("gpt-5.4-mini -> gpt-5.4");
    expect(report).not.toContain("manual-fallback");
    expect(report).toContain("### Run: baseline");
    expect(report).toContain("### Run: override");
  });
});
