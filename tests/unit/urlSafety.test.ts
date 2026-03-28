import { AppError } from "../../src/lib/errors";
import { assertSafeImageUrl, normalizeImageUrl } from "../../src/lib/urlSafety";

describe("urlSafety", () => {
  it("accepts https image URLs", () => {
    expect(assertSafeImageUrl("https://example.com/meal.jpg").toString()).toBe(
      "https://example.com/meal.jpg",
    );
  });

  it("rejects non-https URLs", () => {
    expect(() => assertSafeImageUrl("http://example.com/meal.jpg")).toThrow(
      new AppError(400, "INPUT_REJECTED", "Only https image URLs are allowed"),
    );
  });

  it("normalizes valid URLs", () => {
    expect(normalizeImageUrl("https://example.com/meal.jpg")).toBe(
      "https://example.com/meal.jpg",
    );
  });
});
