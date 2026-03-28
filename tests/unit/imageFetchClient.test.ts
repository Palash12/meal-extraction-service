import { AppError } from "../../src/lib/errors";
import { ImageFetchClient } from "../../src/clients/imageFetchClient";

function createResponse(
  body: string,
  init: {
    status?: number;
    headers?: Record<string, string>;
    url?: string;
  } = {},
): Response {
  const response = new Response(body, {
    status: init.status ?? 200,
    headers: init.headers,
  });

  Object.defineProperty(response, "url", {
    value: init.url ?? "https://example.com/meal.jpg",
  });

  return response;
}

describe("ImageFetchClient", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("fetches image metadata within the allowed policy", async () => {
    jest.spyOn(global, "fetch").mockResolvedValue(
      createResponse("x".repeat(64), {
        headers: {
          "content-type": "image/jpeg",
          "content-length": "64",
        },
      }),
    );

    const client = new ImageFetchClient();
    const result = await client.fetchMetadata("https://example.com/meal.jpg");

    expect(result.contentType).toBe("image/jpeg");
    expect(result.contentLength).toBe(64);
    expect(result.bytesSampled).toBe(64);
    expect(result.policy.redirectLimit).toBe(3);
  });

  it("rejects disallowed content types", async () => {
    jest.spyOn(global, "fetch").mockResolvedValue(
      createResponse("x".repeat(64), {
        headers: {
          "content-type": "image/gif",
        },
      }),
    );

    const client = new ImageFetchClient();

    await expect(client.fetchMetadata("https://example.com/meal.gif")).rejects.toEqual(
      new AppError(400, "INPUT_REJECTED", "Image content type is not allowed"),
    );
  });

  it("rejects oversized content lengths", async () => {
    jest.spyOn(global, "fetch").mockResolvedValue(
      createResponse("x", {
        headers: {
          "content-type": "image/png",
          "content-length": String(10 * 1024 * 1024 + 1),
        },
      }),
    );

    const client = new ImageFetchClient();

    await expect(client.fetchMetadata("https://example.com/meal.png")).rejects.toEqual(
      new AppError(400, "INPUT_REJECTED", "Image content length exceeds the maximum allowed size"),
    );
  });

  it("follows redirects up to the limit", async () => {
    jest
      .spyOn(global, "fetch")
      .mockResolvedValueOnce(
        createResponse("", {
          status: 302,
          headers: {
            location: "https://cdn.example.com/meal.jpg",
          },
          url: "https://example.com/redirect",
        }),
      )
      .mockResolvedValueOnce(
        createResponse("x".repeat(64), {
          headers: {
            "content-type": "image/webp",
          },
          url: "https://cdn.example.com/meal.jpg",
        }),
      );

    const client = new ImageFetchClient();
    const result = await client.fetchMetadata("https://example.com/redirect");

    expect(result.finalUrl).toBe("https://cdn.example.com/meal.jpg");
    expect(result.redirectCount).toBe(1);
  });
});
