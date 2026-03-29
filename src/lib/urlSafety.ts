import { AppError } from "./errors";

const ALLOWED_SCHEMES = new Set(["https:"]);

export function assertSafeImageUrl(imageUrl: string): URL {
  let parsed: URL;

  try {
    parsed = new URL(imageUrl);
  } catch {
    throw new AppError(400, "INPUT_REJECTED", "Image URL is invalid");
  }

  if (!ALLOWED_SCHEMES.has(parsed.protocol)) {
    throw new AppError(
      400,
      "INPUT_REJECTED",
      "Only https image URLs are allowed",
    );
  }

  if (parsed.username || parsed.password) {
    throw new AppError(
      400,
      "INPUT_REJECTED",
      "Image URL credentials are not allowed",
    );
  }

  if (!parsed.hostname) {
    throw new AppError(400, "INPUT_REJECTED", "Image URL hostname is required");
  }

  return parsed;
}

export function normalizeImageUrl(imageUrl: string): string {
  return assertSafeImageUrl(imageUrl).toString();
}
