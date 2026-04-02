const API_PATH = "/v1/meals/analyze";
const DEMO_SCENARIOS = [
  {
    id: "clear-meal",
    title: "Clear meal",
    tagline: "Successful analysis",
    description:
      "Happy path: the model extracts the food, the code grounds the nutrition, and the response stays structured.",
    badge: "success",
    imageUrl:
      "https://upload.wikimedia.org/wikipedia/commons/5/5c/Fried_Rice%2C_Jollof_rice_and_salad%2C_served_with_Grilled_Chicken.jpg",
    userNote:
      "Clear plated meal. Focus on the main meal components only and ignore tiny garnish or scattered toppings that are not clearly separable.",
    requestLabel: "gpt-5.4-mini success path",
    requestHeaderNote: null,
    headers: {},
    expected: "status ok, grounded calories, detected items",
    previewTone: "success",
  },
  {
    id: "non-food",
    title: "Non-food image",
    tagline: "Fast abstention",
    description:
      "This shows the MVP tradeoff: the model can abstain cheaply when the image is not a meal.",
    badge: "warning",
    imageUrl: "https://upload.wikimedia.org/wikipedia/commons/6/61/Laptop_on_a_desk.jpg",
    userNote: "Demo non-food image.",
    requestLabel: "cheap abstention path",
    requestHeaderNote: null,
    headers: {},
    expected: "status abstained, low confidence, low token count",
    previewTone: "warning",
  },
  {
    id: "unsafe-content",
    title: "Unsafe content",
    tagline: "Blocked before inference",
    description:
      "This uses a deterministic demo override so the safety path is always quick and reliable for recording.",
    badge: "danger",
    imageUrl:
      "https://upload.wikimedia.org/wikipedia/commons/5/5c/Fried_Rice%2C_Jollof_rice_and_salad%2C_served_with_Grilled_Chicken.jpg",
    userNote: "Demo safety block. The app should stop before inference.",
    requestLabel: "demo safety block",
    requestHeaderNote: "x-demo-force-unsafe-rejection: true",
    headers: {
      "x-demo-force-unsafe-rejection": "true",
    },
    expected: "INPUT_REJECTED, unsafe_screening blocked, no inference",
    previewTone: "danger",
  },
];

const state = {
  selectedScenarioId: DEMO_SCENARIOS[0].id,
  currentScenarioId: DEMO_SCENARIOS[0].id,
  currentRequestPayload: null,
  currentResponsePayload: null,
  running: false,
  trace: [],
  scenarioRunState: new Map(
    DEMO_SCENARIOS.map((scenario) => [
      scenario.id,
      {
        status: "idle",
        result: null,
      },
    ]),
  ),
};

const nodes = {
  runButton: document.getElementById("run-demo-button"),
  resetButton: document.getElementById("reset-button"),
  demoStatus: document.getElementById("demo-status"),
  scenarioList: document.getElementById("scenario-list"),
  inputSummary: document.getElementById("input-summary"),
  outputSummary: document.getElementById("output-summary"),
  scenarioNote: document.getElementById("scenario-note"),
  requestJson: document.getElementById("request-json"),
  requestHeaders: document.getElementById("request-headers"),
  responseJson: document.getElementById("response-json"),
  resultStatus: document.getElementById("result-status"),
  resultConfidence: document.getElementById("result-confidence"),
  resultItems: document.getElementById("result-items"),
  resultCalories: document.getElementById("result-calories"),
  traceSummary: document.getElementById("trace-summary"),
  traceList: document.getElementById("trace-list"),
};

function formatTime(date = new Date()) {
  return new Intl.DateTimeFormat("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    fractionalSecondDigits: 3,
  }).format(date);
}

function prettyJson(value) {
  return JSON.stringify(value, null, 2);
}

function createRequestId(prefix) {
  const random = typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID().slice(0, 8)
    : Math.random().toString(16).slice(2, 10);
  return `${prefix}-${Date.now()}-${random}`;
}

function setStatus(text) {
  nodes.demoStatus.textContent = text;
}

function setDemoRunning(isRunning) {
  document.body.classList.toggle("is-demo-running", isRunning);
}

function setScenarioStatus(id, status, result = null) {
  state.scenarioRunState.set(id, { status, result });
  renderScenarios();
}

function getScenarioRunState(id) {
  return state.scenarioRunState.get(id) ?? { status: "idle", result: null };
}

function logTrace(event, detail) {
  state.trace.push({
    time: formatTime(),
    event,
    detail,
  });
  renderTrace();
}

function getScenarioCardClass(scenario) {
  const runState = state.scenarioRunState.get(scenario.id);
  const classes = ["scenario-card"];

  if (scenario.id === state.selectedScenarioId) {
    classes.push("is-active");
  }

  if (runState?.status === "running") {
    classes.push("is-running");
  }

  return classes.join(" ");
}

function renderScenarios() {
  nodes.scenarioList.innerHTML = "";

  for (const scenario of DEMO_SCENARIOS) {
    const runState = getScenarioRunState(scenario.id);
    const card = document.createElement("button");
    card.type = "button";
    card.className = getScenarioCardClass(scenario);
    card.addEventListener("click", () => {
      state.selectedScenarioId = scenario.id;
      const selectedRunState = getScenarioRunState(scenario.id);
      state.currentScenarioId = scenario.id;
      state.currentRequestPayload = selectedRunState.result?.requestPayload ?? null;
      state.currentResponsePayload = selectedRunState.result?.responsePayload ?? null;
      renderAll();
    });

    const media = document.createElement("div");
    media.className = "scenario-media";
    if (scenario.previewTone === "danger") {
      media.innerHTML = `
        <div style="height:100%;display:grid;place-items:center;padding:18px;background:linear-gradient(135deg, #4c1d1d, #111827);color:#fff;">
          <div style="text-align:center;">
            <div style="font-size:0.8rem;letter-spacing:0.18em;text-transform:uppercase;opacity:0.8;">Demo override</div>
            <div style="font-family:var(--serif);font-size:1.5rem;margin-top:8px;">Blocked before inference</div>
          </div>
        </div>
      `;
    } else {
      const image = document.createElement("img");
      image.src = scenario.imageUrl;
      image.alt = scenario.title;
      media.appendChild(image);
    }

    const titleRow = document.createElement("div");
    titleRow.className = "scenario-title-row";

    const titleWrap = document.createElement("div");
    const title = document.createElement("h3");
    title.textContent = scenario.title;
    const tagline = document.createElement("div");
    tagline.className = "scenario-desc";
    tagline.textContent = scenario.tagline;
    titleWrap.append(title, tagline);

    const statusTag = document.createElement("span");
    statusTag.className = `tag tag-${scenario.badge}`;
    statusTag.textContent =
      runState?.status === "done"
        ? "done"
        : runState?.status === "running"
          ? "running"
          : "ready";

    titleRow.append(titleWrap, statusTag);

    const description = document.createElement("p");
    description.className = "scenario-desc";
    description.textContent = scenario.description;

    const tags = document.createElement("div");
    tags.className = "scenario-tags";
    const requestTag = document.createElement("span");
    requestTag.className = "tag";
    requestTag.textContent = scenario.requestLabel;
    const expectedTag = document.createElement("span");
    expectedTag.className = `tag tag-${scenario.badge}`;
    expectedTag.textContent = scenario.expected;
    tags.append(requestTag, expectedTag);

    card.append(media, titleRow, description, tags);

    if (runState?.result) {
      const footer = document.createElement("div");
      footer.className = "inline-note";
      const traceSummary = runState.result.traceSummary
        ? ` · ${escapeHtml(runState.result.traceSummary)}`
        : "";
      footer.innerHTML = `<strong>Last run:</strong> ${escapeHtml(runState.result.summary)}${traceSummary}`;
      card.appendChild(footer);
    }

    nodes.scenarioList.appendChild(card);
  }
}

function renderInputPanel(scenario, requestPayload) {
  nodes.inputSummary.textContent = scenario.title;
  nodes.scenarioNote.textContent = scenario.description;
  nodes.requestJson.textContent = prettyJson(requestPayload);
  nodes.requestHeaders.textContent = scenario.requestHeaderNote
    ? `Demo override: ${scenario.requestHeaderNote}`
    : "No demo override header for this scenario.";
}

function renderResponsePanel(scenario, responseData) {
  if (!responseData) {
    nodes.outputSummary.textContent = "Waiting to run";
    nodes.responseJson.textContent = "{}";
    nodes.resultStatus.textContent = "-";
    nodes.resultConfidence.textContent = "-";
    nodes.resultItems.textContent = "-";
    nodes.resultCalories.textContent = "-";
    return;
  }

  nodes.outputSummary.textContent = `${scenario.title} complete`;
  nodes.responseJson.textContent = prettyJson(responseData);

  if (responseData.error) {
    nodes.resultStatus.textContent = `${responseData.error.code}`;
    nodes.resultConfidence.textContent = "n/a";
    nodes.resultItems.textContent = "n/a";
    nodes.resultCalories.textContent = "n/a";
    return;
  }

  nodes.resultStatus.textContent = responseData.status ?? "-";
  nodes.resultConfidence.textContent = responseData.confidence ?? "-";
  nodes.resultItems.textContent = `${responseData.detectedItems?.length ?? 0} item(s)`;

  if (responseData.nutritionEstimate?.calories) {
    const { lower, upper } = responseData.nutritionEstimate.calories;
    nodes.resultCalories.textContent = `${lower.toFixed(1)} - ${upper.toFixed(1)} kcal`;
  } else {
    nodes.resultCalories.textContent = "Not grounded";
  }
}

function renderTrace() {
  nodes.traceSummary.textContent = `${state.trace.length} event${state.trace.length === 1 ? "" : "s"}`;

  if (state.trace.length === 0) {
    nodes.traceList.innerHTML = '<div class="trace-empty">No requests yet.</div>';
    return;
  }

  nodes.traceList.innerHTML = "";
  for (const entry of state.trace) {
    const item = document.createElement("div");
    item.className = "trace-item";

    const time = document.createElement("div");
    time.className = "trace-time";
    time.textContent = entry.time;

    const event = document.createElement("div");
    event.className = "trace-event";
    event.textContent = entry.event;

    const detail = document.createElement("div");
    detail.className = "trace-detail";
    detail.textContent = entry.detail;

    item.append(time, event, detail);
    nodes.traceList.appendChild(item);
  }
}

function renderAll() {
  renderScenarios();
  const scenario = DEMO_SCENARIOS.find((item) => item.id === state.selectedScenarioId);
  if (!scenario) {
    return;
  }

  const runState = getScenarioRunState(scenario.id);
  let requestPayload;
  if (state.currentScenarioId === scenario.id && state.currentRequestPayload) {
    requestPayload = state.currentRequestPayload;
  } else if (runState.result?.requestPayload) {
    requestPayload = runState.result.requestPayload;
  } else {
    requestPayload = {
      request_id: createRequestId(scenario.id),
      image_url: scenario.imageUrl,
      user_note: scenario.userNote,
    };
  }

  const responsePayload =
    state.currentScenarioId === scenario.id
      ? state.currentResponsePayload ?? runState.result?.responsePayload ?? null
      : runState.result?.responsePayload ?? null;

  renderInputPanel(scenario, requestPayload);
  renderResponsePanel(scenario, responsePayload);
}

function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

async function runScenario(scenario) {
  state.selectedScenarioId = scenario.id;
  state.currentScenarioId = scenario.id;
  setScenarioStatus(scenario.id, "running");
  setStatus(`Running: ${scenario.title}`);

  const requestId = createRequestId(scenario.id);
  const requestPayload = {
    request_id: requestId,
    image_url: scenario.imageUrl,
    user_note: scenario.userNote,
  };
  const traceStartIndex = state.trace.length;

  state.currentRequestPayload = requestPayload;
  state.currentResponsePayload = null;
  renderInputPanel(scenario, requestPayload);
  renderResponsePanel(scenario, null);
  logTrace("queued", `${scenario.title} prepared for send`);
  logTrace("sent", `${requestId} posted to ${API_PATH}`);

  const startedAt = performance.now();
  let response;
  let responseBody;

  try {
    response = await fetch(API_PATH, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...scenario.headers,
      },
      body: JSON.stringify(requestPayload),
    });

    responseBody = await response.json();
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown network error";
    logTrace("error", `${scenario.title} failed: ${message}`);
    const responsePayload = {
      error: {
        code: "NETWORK_ERROR",
        message,
        retryable: true,
      },
    };
    setScenarioStatus(scenario.id, "done", {
      requestId,
      summary: "network error",
      traceSummary: `${state.trace.length - traceStartIndex} event${
        state.trace.length - traceStartIndex === 1 ? "" : "s"
      }`,
      requestPayload,
      responsePayload,
      payload: responsePayload,
    });
    state.currentResponsePayload = responsePayload;
    renderResponsePanel(scenario, responsePayload);
    setStatus("Network error");
    return;
  }

  const elapsed = Math.round(performance.now() - startedAt);
  const requestIdHeader = response.headers.get("x-request-id") ?? requestId;
  const summary = buildResponseSummary(responseBody, response.ok, elapsed);
  const responsePayload = {
    requestId: requestIdHeader,
    ...responseBody,
  };
  state.currentResponsePayload = responsePayload;
  renderResponsePanel(scenario, responsePayload);

  logTrace(
    response.ok ? "received" : "blocked",
    `${requestIdHeader} returned ${response.status} in ${elapsed}ms`,
  );
  logTrace("done", `${scenario.title} ${summary}`);
  setScenarioStatus(scenario.id, "done", {
    requestId: requestIdHeader,
    summary,
    traceSummary: `${state.trace.length - traceStartIndex} event${
      state.trace.length - traceStartIndex === 1 ? "" : "s"
    }`,
    requestPayload,
    responsePayload,
    payload: {
      ...responsePayload,
    },
  });
  setStatus(`${scenario.title} complete`);
}

function buildResponseSummary(body, ok, elapsed) {
  if (body?.error) {
    return `${body.error.code} (${elapsed}ms)`;
  }

  if (ok && body?.status === "ok") {
    return `success (${elapsed}ms)`;
  }

  if (ok && body?.status === "abstained") {
    return `abstained (${elapsed}ms)`;
  }

  return `completed (${elapsed}ms)`;
}

async function runDemo() {
  if (state.running) {
    return;
  }

  state.running = true;
  setDemoRunning(true);
  nodes.runButton.disabled = true;
  nodes.resetButton.disabled = true;
  setStatus("Running full demo");
  logTrace("start", "Auto-running all three demo scenarios");

  try {
    for (const scenario of DEMO_SCENARIOS) {
      await runScenario(scenario);
      await sleep(850);
    }
    setStatus("Demo finished");
  } finally {
    state.running = false;
    setDemoRunning(false);
    nodes.runButton.disabled = false;
    nodes.resetButton.disabled = false;
    renderScenarios();
  }
}

function resetDemo() {
  if (state.running) {
    return;
  }

  setDemoRunning(false);
  state.selectedScenarioId = DEMO_SCENARIOS[0].id;
  state.currentScenarioId = DEMO_SCENARIOS[0].id;
  state.currentRequestPayload = null;
  state.currentResponsePayload = null;
  state.trace = [];
  for (const scenario of DEMO_SCENARIOS) {
    state.scenarioRunState.set(scenario.id, { status: "idle", result: null });
  }
  setStatus("Ready");
  renderAll();
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

nodes.runButton.addEventListener("click", runDemo);
nodes.resetButton.addEventListener("click", resetDemo);

renderAll();
renderTrace();
