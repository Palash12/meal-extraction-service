export interface ModelTraceContext {
  requestId: string;
  inferenceModel: string | null;
  moderationModel: string | null;
  promptVersion: string | null;
}

export function createTraceContext(
  context: ModelTraceContext,
): ModelTraceContext {
  return context;
}
