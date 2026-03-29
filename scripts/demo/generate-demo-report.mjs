#!/usr/bin/env node

import {
  createWriteStream,
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "fs";
import { dirname, join, resolve } from "path";
import { spawn } from "child_process";
import { fileURLToPath } from "url";
import { createRequire } from "module";
import dotenv from "dotenv";

const require = createRequire(import.meta.url);
const {
  buildReport,
  derivePerformance,
  parseJson,
  parseLogEntriesForRequest,
  unavailablePerformance,
} = require("./reporting.cjs");

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "..", "..");
const artifactDir = resolve(repoRoot, "artifacts", "demo");
const tsNodeBin = resolve(
  repoRoot,
  "node_modules",
  ".bin",
  process.platform === "win32" ? "ts-node.cmd" : "ts-node",
);

dotenv.config({ path: resolve(repoRoot, ".env") });
mkdirSync(artifactDir, { recursive: true });

const defaultScenarioInputs = {
  DEMO_CLEAR_MEAL_URL:
    process.env.DEMO_CLEAR_MEAL_URL ??
    "https://upload.wikimedia.org/wikipedia/commons/5/5c/Fried_Rice%2C_Jollof_rice_and_salad%2C_served_with_Grilled_Chicken.jpg",
  DEMO_AMBIGUOUS_MEAL_URL:
    process.env.DEMO_AMBIGUOUS_MEAL_URL ??
    "https://upload.wikimedia.org/wikipedia/commons/1/18/Fish_Curry_Rice_Plate_%2826138495975%29.jpg",
  DEMO_NONFOOD_IMAGE_URL:
    process.env.DEMO_NONFOOD_IMAGE_URL ??
    "https://upload.wikimedia.org/wikipedia/commons/6/61/Laptop_on_a_desk.jpg",
};

const baselineModel = process.env.OPENAI_MODEL ?? "gpt-5.4-mini";
const compareModelOverride =
  process.env.DEMO_COMPARE_MODEL_OVERRIDE ??
  (baselineModel === "gpt-5.4" ? "gpt-5.4-mini" : "gpt-5.4");
const tokenCapOverride = process.env.DEMO_COMPARE_MAX_OUTPUT_TOKENS ?? "240";

let nextPort = Number(process.env.DEMO_REPORT_BASE_PORT ?? 3210);

const singleScenarioDefinitions = [
  {
    key: "baseline-success",
    name: "Baseline Successful Meal Analysis",
    script: "scripts/demo/demo-success.sh",
    requestIdPrefix: "demo-success-report",
    purpose:
      "Show the happy path across validation, fetch, moderation, inference, and output guardrails.",
    expectedOutcome:
      "HTTP 200 with status ok and structured meal-analysis fields.",
    tradeoffs: ["accuracy/usefulness", "latency", "cost", "safety"],
    envOverrides: {},
    evaluate: (run) => run.httpStatus === 200 && run.responseBody?.status === "ok",
  },
  {
    key: "ambiguous-meal",
    name: "Ambiguous Meal",
    script: "scripts/demo/demo-ambiguous.sh",
    requestIdPrefix: "demo-ambiguous-report",
    purpose:
      "Show abstention, clarification, or other bounded low-confidence behavior.",
    expectedOutcome:
      "HTTP 200 with abstention, clarification, or other clearly uncertain behavior.",
    tradeoffs: ["accuracy/usefulness", "safety"],
    envOverrides: {},
    evaluate: (run) =>
      run.httpStatus === 200 &&
      (run.responseBody?.status === "abstained" ||
        run.responseBody?.clarifyingQuestion !== null ||
        run.responseBody?.confidence === "low"),
  },
  {
    key: "input-rejection",
    name: "Input Rejection",
    script: "scripts/demo/demo-input-rejection.sh",
    requestIdPrefix: "demo-input-rejection-report",
    purpose:
      "Show a fast local validation failure before any expensive upstream work.",
    expectedOutcome: "HTTP 400 with VALIDATION_ERROR.",
    tradeoffs: ["latency", "cost", "safety"],
    envOverrides: {},
    evaluate: (run) =>
      run.httpStatus === 400 &&
      run.responseBody?.error?.code === "VALIDATION_ERROR",
  },
  {
    key: "nonfood",
    name: "Non-Food Image",
    script: "scripts/demo/demo-nonfood.sh",
    requestIdPrefix: "demo-nonfood-report",
    purpose:
      "Show the current MVP limitation: non-food may abstain or behave cautiously rather than deterministically reject.",
    expectedOutcome:
      "Cautious behavior such as abstention, low confidence, or a rejection if your setup supports it.",
    tradeoffs: ["accuracy/usefulness", "safety"],
    envOverrides: {},
    evaluate: (run) =>
      (run.httpStatus === 200 &&
        (run.responseBody?.status === "abstained" ||
          run.responseBody?.clarifyingQuestion !== null ||
          run.responseBody?.confidence === "low")) ||
      (run.httpStatus === 400 &&
        run.responseBody?.error?.code === "INPUT_REJECTED"),
  },
  {
    key: "upstream-failure",
    name: "Upstream Failure",
    script: "scripts/demo/demo-upstream-failure.sh",
    requestIdPrefix: "demo-upstream-failure-report",
    purpose: "Show stable upstream failure handling.",
    expectedOutcome: "HTTP 502 with UPSTREAM_INFERENCE_FAILURE.",
    tradeoffs: ["safety", "reliability"],
    envOverrides: {
      DEMO_FORCE_INFERENCE_FAILURE: "true",
    },
    evaluate: (run) =>
      run.httpStatus === 502 &&
      run.responseBody?.error?.code === "UPSTREAM_INFERENCE_FAILURE",
  },
  {
    key: "unsafe-rejection",
    name: "Unsafe Content Rejection",
    script: "scripts/demo/demo-unsafe-rejection.sh",
    requestIdPrefix: "demo-unsafe-rejection-report",
    purpose: "Show moderation-backed early stopping before inference.",
    expectedOutcome:
      "HTTP 400 with INPUT_REJECTED after unsafe screening blocks the request.",
    tradeoffs: ["safety", "latency", "cost"],
    envOverrides: {
      DEMO_FORCE_UNSAFE_REJECTION: "true",
    },
    evaluate: (run) =>
      run.httpStatus === 400 &&
      run.responseBody?.error?.code === "INPUT_REJECTED" &&
      run.logFields.entries.some(
        (entry) => entry.event === "unsafe_content_rejected",
      ),
  },
];

const comparisonScenarioDefinitions = [
  {
    key: "model-compare",
    name: "Model Comparison",
    script: "scripts/demo/demo-model-compare.sh",
    purpose:
      "Run the same clear meal twice with different app startup config via INFERENCE_MODEL_OVERRIDE.",
    expectedOutcome:
      "Two runs on the same image with different model_name values in the logs.",
    tradeoffs: ["accuracy/usefulness", "latency", "cost"],
    runs: [
      {
        label: "baseline",
        requestIdPrefix: "demo-model-compare-baseline-report",
        envOverrides: {},
      },
      {
        label: "override",
        requestIdPrefix: "demo-model-compare-override-report",
        envOverrides: {
          INFERENCE_MODEL_OVERRIDE: compareModelOverride,
        },
      },
    ],
    evaluate: (runs) =>
      runs.length === 2 &&
      runs.every((run) => run.httpStatus === 200) &&
      new Set(runs.map((run) => run.performance.inference_model)).size === 2,
  },
  {
    key: "token-cap",
    name: "Output Token Cap Comparison",
    script: "scripts/demo/demo-token-cap.sh",
    purpose:
      "Run the same clear meal twice with and without MAX_OUTPUT_TOKENS.",
    expectedOutcome:
      "Two runs on the same image with visible token and possibly latency/cost differences.",
    tradeoffs: ["cost", "latency", "accuracy/usefulness"],
    runs: [
      {
        label: "default",
        requestIdPrefix: "demo-token-cap-default-report",
        envOverrides: {},
      },
      {
        label: "capped",
        requestIdPrefix: "demo-token-cap-capped-report",
        envOverrides: {
          MAX_OUTPUT_TOKENS: tokenCapOverride,
        },
      },
    ],
    evaluate: (runs) =>
      runs.length === 2 &&
      runs.every((run) => run.httpStatus === 200) &&
      runs[1].performance.output_tokens !== null &&
      runs[0].performance.output_tokens !== null &&
      runs[0].performance.output_tokens !== runs[1].performance.output_tokens,
  },
];

async function main() {
  const results = [];

  for (const definition of singleScenarioDefinitions) {
    results.push(await runSingleScenario(definition));
  }

  for (const definition of comparisonScenarioDefinitions) {
    results.push(await runComparisonScenario(definition));
  }

  writeFileSync(
    join(artifactDir, "results.json"),
    JSON.stringify(results, null, 2),
  );
  writeFileSync(join(artifactDir, "report.md"), buildReport(results));

  console.log(`Wrote artifacts/demo/results.json`);
  console.log(`Wrote artifacts/demo/report.md`);
}

async function runSingleScenario(definition) {
  const scenarioDir = join(artifactDir, definition.key);
  mkdirSync(scenarioDir, { recursive: true });

  const run = await runManagedScript({
    scenarioDir,
    label: "default",
    script: definition.script,
    requestId: `${definition.requestIdPrefix}-${Date.now()}`,
    envOverrides: definition.envOverrides,
    imageUrl: resolveScenarioImageUrl(definition.script),
  });

  return {
    key: definition.key,
    name: definition.name,
    purpose: definition.purpose,
    tradeoffs: definition.tradeoffs,
    expectedOutcome: definition.expectedOutcome,
    actualOutcome: formatSingleActualOutcome(run),
    pass: definition.evaluate(run) ? "pass" : "fail",
    mode: "automated",
    script: definition.script,
    runs: [run],
    summary: {
      httpAndStatus: `${run.httpStatus ?? "-"} / ${run.responseBody?.status ?? run.responseBody?.error?.code ?? "-"}`,
    },
  };
}

async function runComparisonScenario(definition) {
  const scenarioDir = join(artifactDir, definition.key);
  mkdirSync(scenarioDir, { recursive: true });

  const runs = [];
  for (const runDefinition of definition.runs) {
    runs.push(
      await runManagedScript({
        scenarioDir,
        label: runDefinition.label,
        script: definition.script,
        requestId: `${runDefinition.requestIdPrefix}-${Date.now()}`,
        envOverrides: runDefinition.envOverrides,
        imageUrl: resolveScenarioImageUrl(definition.script),
      }),
    );
  }

  return {
    key: definition.key,
    name: definition.name,
    purpose: definition.purpose,
    tradeoffs: definition.tradeoffs,
    expectedOutcome: definition.expectedOutcome,
    actualOutcome: runs
      .map(
        (run) =>
          `${run.label}: HTTP ${run.httpStatus ?? "-"} / ${run.responseBody?.status ?? run.responseBody?.error?.code ?? "-"}`,
      )
      .join("; "),
    pass: definition.evaluate(runs) ? "pass" : "fail",
    mode: "automated",
    script: definition.script,
    runs,
    summary: {
      httpAndStatus: runs
        .map(
          (run) =>
            `${run.httpStatus ?? "-"} / ${run.responseBody?.status ?? run.responseBody?.error?.code ?? "-"}`,
        )
        .join(" -> "),
    },
  };
}

function formatSingleActualOutcome(run) {
  if (run.responseBody?.status) {
    return `HTTP ${run.httpStatus} with status ${run.responseBody.status}`;
  }

  if (run.responseBody?.error?.code) {
    return `HTTP ${run.httpStatus} with error ${run.responseBody.error.code}`;
  }

  return `HTTP ${run.httpStatus ?? "-"} without a parseable payload`;
}

async function runManagedScript({
  scenarioDir,
  label,
  script,
  requestId,
  envOverrides,
  imageUrl,
}) {
  const port = nextPort++;
  const logPath = join(scenarioDir, `${label}.log`);
  const responsePath = join(scenarioDir, `${label}-response.json`);
  const statusPath = join(scenarioDir, `${label}-status.txt`);

  const appEnv = {
    ...process.env,
    PORT: String(port),
    DEMO_MODE: "true",
    DECISION_LOGGING_ENABLED: "true",
    ENABLE_UNSAFE_SCREENING: "true",
    ENABLE_OUTPUT_GUARDRAILS: "true",
    FORCE_ABSTAIN_ON_LOW_CONFIDENCE: "true",
    DEMO_FORCE_UNSAFE_REJECTION: "false",
    DEMO_FORCE_INFERENCE_FAILURE: "false",
    ...envOverrides,
  };

  await withManagedApp(logPath, appEnv, async ({ baseUrl }) => {
    await runScript(resolve(repoRoot, script), {
      ...process.env,
      ...defaultScenarioInputs,
      BASE_URL: baseUrl,
      REQUEST_ID: requestId,
      ARTIFACT_RESPONSE_FILE: responsePath,
      ARTIFACT_STATUS_FILE: statusPath,
    });
  });

  const logText = existsSync(logPath) ? readFileSync(logPath, "utf8") : "";
  const logFields = await waitForRequestLogs(logText, logPath, requestId);
  const responseText = existsSync(responsePath)
    ? readFileSync(responsePath, "utf8")
    : "";

  return {
    label,
    requestId,
    imageUrl,
    httpStatus: existsSync(statusPath)
      ? Number(readFileSync(statusPath, "utf8").trim())
      : null,
    responseBody: parseJson(responseText),
    performance: logFields.performance,
    logFields,
  };
}

function resolveScenarioImageUrl(script) {
  const scriptName = script.split("/").pop();

  if (scriptName === "demo-ambiguous.sh") {
    return defaultScenarioInputs.DEMO_AMBIGUOUS_MEAL_URL;
  }

  if (scriptName === "demo-nonfood.sh") {
    return defaultScenarioInputs.DEMO_NONFOOD_IMAGE_URL;
  }

  if (
    scriptName === "demo-success.sh" ||
    scriptName === "demo-model-compare.sh" ||
    scriptName === "demo-token-cap.sh" ||
    scriptName === "demo-upstream-failure.sh" ||
    scriptName === "demo-unsafe-rejection.sh"
  ) {
    return defaultScenarioInputs.DEMO_CLEAR_MEAL_URL;
  }

  return null;
}

async function withManagedApp(logPath, env, fn) {
  rmSync(logPath, { force: true });
  const logStream = createWriteStream(logPath, { flags: "a" });
  const appProcess = spawn(tsNodeBin, ["--transpile-only", "src/server.ts"], {
    cwd: repoRoot,
    env,
    stdio: ["ignore", "pipe", "pipe"],
  });

  appProcess.stdout.on("data", (chunk) => logStream.write(chunk));
  appProcess.stderr.on("data", (chunk) => logStream.write(chunk));

  try {
    await waitForServer(`http://127.0.0.1:${env.PORT}`);
    await fn({ baseUrl: `http://127.0.0.1:${env.PORT}` });
  } finally {
    await stopProcess(appProcess);
    await Promise.race([
      new Promise((resolveLogClose) => logStream.end(resolveLogClose)),
      sleep(1_000),
    ]);
  }
}

async function runScript(command, env) {
  const child = spawn(command, {
    cwd: repoRoot,
    env,
    stdio: ["ignore", "pipe", "pipe"],
  });

  let stdout = "";
  let stderr = "";

  child.stdout.on("data", (chunk) => {
    stdout += String(chunk);
  });
  child.stderr.on("data", (chunk) => {
    stderr += String(chunk);
  });

  const exitCode = await new Promise((resolveExit, rejectExit) => {
    child.once("error", rejectExit);
    child.once("exit", (code) => resolveExit(code ?? 1));
  });

  if (exitCode !== 0) {
    throw new Error(
      `Scenario script failed with exit code ${exitCode}: ${stderr || stdout}`,
    );
  }

  return { stdout, stderr };
}

async function waitForServer(baseUrl) {
  const deadline = Date.now() + 20_000;

  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${baseUrl}/__demo_ready__`);
      if (response.status >= 200) {
        return;
      }
    } catch {}

    await sleep(200);
  }

  throw new Error(`Timed out waiting for app startup at ${baseUrl}`);
}

async function waitForRequestLogs(initialLogText, logPath, requestId) {
  const deadline = Date.now() + 5_000;
  let logText = initialLogText;

  while (Date.now() < deadline) {
    const entries = parseLogEntriesForRequest(logText, requestId);
    if (entries.some((entry) => entry.event === "request_completed")) {
      return {
        source: relativeToRoot(logPath),
        entries,
        performance: derivePerformance(entries),
      };
    }

    await sleep(100);
    logText = existsSync(logPath) ? readFileSync(logPath, "utf8") : "";
  }

  const entries = parseLogEntriesForRequest(logText, requestId);
  return {
    source: relativeToRoot(logPath),
    entries,
    performance:
      entries.length > 0 ? derivePerformance(entries) : unavailablePerformance(),
  };
}

async function stopProcess(appProcess) {
  if (appProcess.killed || appProcess.exitCode !== null) {
    return;
  }

  const waitForExit = () =>
    new Promise((resolveProcess) => appProcess.once("exit", resolveProcess));

  let exitPromise = waitForExit();
  const sentSigterm = appProcess.kill("SIGTERM");
  if (!sentSigterm) {
    return;
  }
  await Promise.race([
    exitPromise,
    sleep(5_000),
  ]);

  if (appProcess.exitCode === null) {
    exitPromise = waitForExit();
    const sentSigkill = appProcess.kill("SIGKILL");
    if (!sentSigkill) {
      return;
    }
    await Promise.race([
      exitPromise,
      sleep(1_000),
    ]);
  }
}

function relativeToRoot(path) {
  return path.startsWith(`${repoRoot}/`)
    ? path.slice(repoRoot.length + 1)
    : path;
}

function sleep(ms) {
  return new Promise((resolveSleep) => setTimeout(resolveSleep, ms));
}

const keepAlive = setInterval(() => {
  void 0;
}, 1_000);

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => {
    clearInterval(keepAlive);
  });
