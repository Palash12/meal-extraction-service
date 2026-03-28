export interface ModelTrace {
  requestId: string;
  inferenceModel: string | null;
  moderationModel: string | null;
  promptVersion: string | null;
}
