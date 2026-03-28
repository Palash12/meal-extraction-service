"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.logger = void 0;
function emit(event) {
    console.log(JSON.stringify({
        timestamp: new Date().toISOString(),
        ...event,
    }));
}
exports.logger = {
    requestCompleted: (event) => emit({ event: "request_completed", ...event }),
    inputRejected: (event) => emit({ event: "input_rejected", ...event }),
    unsafeContentRejected: (event) => emit({ event: "unsafe_content_rejected", ...event }),
    outputGuardrailApplied: (event) => emit({ event: "output_guardrail_applied", ...event }),
    upstreamCallFailed: (event) => emit({ event: "upstream_call_failed", ...event }),
};
