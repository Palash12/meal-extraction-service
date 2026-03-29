export interface RetryOptions {
  maxAttempts: number;
  baseDelayMs: number;
  maxDelayMs: number;
  shouldRetry: (error: unknown) => boolean;
  onRetry?: (error: unknown, attempt: number, delayMs: number) => void;
}

function computeDelay(
  baseDelayMs: number,
  maxDelayMs: number,
  attempt: number,
): number {
  return Math.min(baseDelayMs * 2 ** (attempt - 1), maxDelayMs);
}

function wait(delayMs: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, delayMs));
}

export async function retryWithBackoff<T>(
  operation: () => Promise<T>,
  options: RetryOptions,
): Promise<T> {
  let attempt = 0;

  while (true) {
    attempt += 1;

    try {
      return await operation();
    } catch (error) {
      const shouldRetry =
        options.shouldRetry(error) && attempt < options.maxAttempts;

      if (!shouldRetry) {
        throw error;
      }

      const delayMs = computeDelay(
        options.baseDelayMs,
        options.maxDelayMs,
        attempt,
      );
      options.onRetry?.(error, attempt, delayMs);
      await wait(delayMs);
    }
  }
}
