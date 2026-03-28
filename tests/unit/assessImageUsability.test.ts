import { assessImageUsability } from "../../src/pipeline/inputGuardrails/assessImageUsability";
import type { ImageFetchMetadata } from "../../src/types/pipeline";

const baseMetadata: ImageFetchMetadata = {
  finalUrl: "https://example.com/meal.jpg",
  contentType: "image/jpeg",
  contentLength: 128,
  bytesSampled: 128,
  redirectCount: 0,
  policy: {
    allowedSchemes: ["https"],
    redirectLimit: 3,
    maxContentLengthBytes: 10 * 1024 * 1024,
    connectionTimeoutMs: 2_000,
    readTimeoutMs: 5_000,
    allowedContentTypes: ["image/jpeg", "image/png", "image/webp"],
  },
};

describe("assessImageUsability", () => {
  it("accepts usable image metadata", () => {
    expect(assessImageUsability(baseMetadata)).toMatchObject({
      accepted: true,
      rejectionCode: null,
      policyFlags: [],
    });
  });

  it("rejects empty images", () => {
    expect(
      assessImageUsability({
        ...baseMetadata,
        contentLength: 0,
        bytesSampled: 0,
      }),
    ).toMatchObject({
      accepted: false,
      rejectionCode: "INPUT_REJECTED",
      policyFlags: ["UNUSABLE_IMAGE"],
    });
  });
});
