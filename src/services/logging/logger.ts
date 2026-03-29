import type {
  InputRejectedLogEvent,
  OutputGuardrailAppliedLogEvent,
  RequestCompletedLogEvent,
  StructuredLogEvent,
  UnsafeContentRejectedLogEvent,
  UpstreamCallFailedLogEvent,
} from "../../types/observability";

function emit(event: StructuredLogEvent): void {
  console.log(
    JSON.stringify({
      timestamp: new Date().toISOString(),
      ...event,
    }),
  );
}

export const logger = {
  requestCompleted: (event: Omit<RequestCompletedLogEvent, "event">): void =>
    emit({ event: "request_completed", ...event }),
  inputRejected: (event: Omit<InputRejectedLogEvent, "event">): void =>
    emit({ event: "input_rejected", ...event }),
  unsafeContentRejected: (
    event: Omit<UnsafeContentRejectedLogEvent, "event">,
  ): void => emit({ event: "unsafe_content_rejected", ...event }),
  outputGuardrailApplied: (
    event: Omit<OutputGuardrailAppliedLogEvent, "event">,
  ): void => emit({ event: "output_guardrail_applied", ...event }),
  upstreamCallFailed: (
    event: Omit<UpstreamCallFailedLogEvent, "event">,
  ): void => emit({ event: "upstream_call_failed", ...event }),
};
