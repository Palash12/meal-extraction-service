import type {
  TraceSpanAttributes,
  TraceSpanName,
} from "../../types/observability";

export interface Tracer {
  startSpan: (name: TraceSpanName, attributes?: TraceSpanAttributes) => void;
}

export const noOpTracer: Tracer = {
  startSpan: (): void => undefined,
};
