import type { ImageFetchMetadata } from "../../types/pipeline";
import type { ImageFetchClient } from "../../clients/imageFetchClient";

export async function fetchImageMetadata(
  imageFetchClient: ImageFetchClient,
  imageUrl: string,
  requestId?: string,
): Promise<ImageFetchMetadata> {
  return imageFetchClient.fetchMetadata(imageUrl, requestId);
}
