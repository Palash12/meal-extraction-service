import { retryWithBackoff } from "../../src/lib/retry";

describe("retryWithBackoff", () => {
  it("retries transient failures until success", async () => {
    jest.useFakeTimers();

    const operation = jest
      .fn<Promise<string>, []>()
      .mockRejectedValueOnce(new Error("temporary"))
      .mockRejectedValueOnce(new Error("temporary"))
      .mockResolvedValue("ok");

    const promise = retryWithBackoff(operation, {
      maxAttempts: 3,
      baseDelayMs: 10,
      maxDelayMs: 100,
      shouldRetry: () => true,
    });

    await jest.advanceTimersByTimeAsync(30);
    await expect(promise).resolves.toBe("ok");
    expect(operation).toHaveBeenCalledTimes(3);

    jest.useRealTimers();
  });

  it("does not retry non-retryable failures", async () => {
    const error = new Error("fatal");
    const operation = jest.fn<Promise<string>, []>().mockRejectedValue(error);

    await expect(
      retryWithBackoff(operation, {
        maxAttempts: 3,
        baseDelayMs: 10,
        maxDelayMs: 100,
        shouldRetry: () => false,
      }),
    ).rejects.toThrow("fatal");

    expect(operation).toHaveBeenCalledTimes(1);
  });
});
