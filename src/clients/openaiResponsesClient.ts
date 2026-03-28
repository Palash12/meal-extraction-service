import OpenAI from "openai";

import { AppError } from "../lib/errors";
import { logger } from "../lib/logger";
import {
  mealExtractionJsonSchema,
  MealExtractionResultSchema,
  type MealExtractionOutput,
} from "../schemas/mealExtraction";
import type { MealExtractionRequest } from "../types/api";

type ResponsesCreateParams = Parameters<OpenAI["responses"]["create"]>[0] & {
  stream?: false;
};

export interface ResponsesApi {
  create: OpenAI["responses"]["create"];
}

export interface MealExtractionClient {
  extractMeal: (request: MealExtractionRequest) => Promise<MealExtractionOutput>;
}

export class OpenAIResponsesClient implements MealExtractionClient {
  constructor(
    private readonly responsesApi: ResponsesApi,
    private readonly model: string,
  ) {}

  async extractMeal(request: MealExtractionRequest): Promise<MealExtractionOutput> {
    const response = await this.responsesApi.create(this.buildRequest(request));
    const payload = this.extractText(response);

    logger.info("openai_response_received", {
      request_id: request.request_id,
      model: this.model,
    });

    try {
      const parsed = JSON.parse(payload) as unknown;
      return MealExtractionResultSchema.parse(parsed);
    } catch (error) {
      throw new AppError(502, "UPSTREAM_INVALID_RESPONSE", "OpenAI returned invalid structured output", {
        cause: error instanceof Error ? error.message : "Unknown parse error",
      });
    }
  }

  private buildRequest(request: MealExtractionRequest): ResponsesCreateParams {
    const userContent: Array<{ type: "input_text"; text: string } | { type: "input_image"; image_url: string; detail: "high" }> = [
      {
        type: "input_text",
        text: "Analyze this meal image and return only the requested JSON fields. Do not calculate nutrition.",
      },
      {
        type: "input_image",
        image_url: request.image_url,
        detail: "high",
      },
    ];

    if (request.user_note) {
      userContent.push({
        type: "input_text",
        text: `User note: ${request.user_note}`,
      });
    }

    return {
      model: this.model,
      store: false,
      stream: false,
      input: [
        {
          role: "developer",
          content: [
            {
              type: "input_text",
              text:
                "Extract meal observations from the provided image. Return JSON only. " +
                "Use the schema exactly. Separate observed, assumed, and unknown facts clearly. " +
                "If uncertainty remains, set needs_user_confirmation to true and ask one clarifying question. " +
                "Do not perform nutrition calculations.",
            },
          ],
        },
        {
          role: "user",
          content: userContent,
        },
      ],
      text: {
        format: {
          type: "json_schema",
          name: "meal_extraction",
          schema: mealExtractionJsonSchema,
          strict: true,
        },
      },
    };
  }

  private extractText(
    response: Awaited<ReturnType<OpenAI["responses"]["create"]>>,
  ): string {
    if (
      "output_text" in response &&
      typeof response.output_text === "string" &&
      response.output_text.trim().length > 0
    ) {
      return response.output_text;
    }

    if ("output" in response) {
      for (const item of response.output ?? []) {
        if (!("content" in item) || !Array.isArray(item.content)) {
          continue;
        }

        for (const contentItem of item.content) {
          if (
            typeof contentItem === "object" &&
            contentItem !== null &&
            "type" in contentItem &&
            contentItem.type === "output_text" &&
            "text" in contentItem &&
            typeof contentItem.text === "string"
          ) {
            return contentItem.text;
          }
        }
      }
    }

    throw new AppError(502, "UPSTREAM_EMPTY_RESPONSE", "OpenAI returned no text output");
  }
}
