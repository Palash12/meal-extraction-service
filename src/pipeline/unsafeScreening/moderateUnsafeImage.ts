import type { OpenAIClient } from "../../clients/openaiClient";
import type {
  ImageFetchMetadata,
  UnsafeScreeningResult,
} from "../../types/pipeline";

export async function moderateUnsafeImage(
  openAIClient: OpenAIClient,
  metadata: ImageFetchMetadata,
  requestId?: string,
): Promise<UnsafeScreeningResult> {
  return openAIClient.screenUnsafeImage(metadata.finalUrl, requestId);
}
