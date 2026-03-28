export interface TimeoutOptions {
  timeoutMs: number;
}

export async function withTimeout<T>(operation: Promise<T>, _options: TimeoutOptions): Promise<T> {
  // TODO: Add timeout enforcement once external fetch and upstream calls are implemented.
  return operation;
}
