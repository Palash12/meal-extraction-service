"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.retryWithBackoff = retryWithBackoff;
function computeDelay(baseDelayMs, maxDelayMs, attempt) {
    return Math.min(baseDelayMs * 2 ** (attempt - 1), maxDelayMs);
}
function wait(delayMs) {
    return new Promise((resolve) => setTimeout(resolve, delayMs));
}
async function retryWithBackoff(operation, options) {
    let attempt = 0;
    while (true) {
        attempt += 1;
        try {
            return await operation();
        }
        catch (error) {
            const shouldRetry = options.shouldRetry(error) && attempt < options.maxAttempts;
            if (!shouldRetry) {
                throw error;
            }
            const delayMs = computeDelay(options.baseDelayMs, options.maxDelayMs, attempt);
            options.onRetry?.(error, attempt, delayMs);
            await wait(delayMs);
        }
    }
}
