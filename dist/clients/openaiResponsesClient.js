"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OpenAIResponsesClient = void 0;
const errors_1 = require("../lib/errors");
const logger_1 = require("../lib/logger");
const mealExtraction_1 = require("../schemas/mealExtraction");
class OpenAIResponsesClient {
    responsesApi;
    model;
    constructor(responsesApi, model) {
        this.responsesApi = responsesApi;
        this.model = model;
    }
    async extractMeal(request) {
        const response = await this.responsesApi.create(this.buildRequest(request));
        const payload = this.extractText(response);
        logger_1.logger.info("openai_response_received", {
            request_id: request.request_id,
            model: this.model,
        });
        try {
            const parsed = JSON.parse(payload);
            return mealExtraction_1.MealExtractionResultSchema.parse(parsed);
        }
        catch (error) {
            throw new errors_1.AppError(502, "UPSTREAM_INVALID_RESPONSE", "OpenAI returned invalid structured output", {
                cause: error instanceof Error ? error.message : "Unknown parse error",
            });
        }
    }
    buildRequest(request) {
        const userContent = [
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
                            text: "Extract meal observations from the provided image. Return JSON only. " +
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
                    schema: mealExtraction_1.mealExtractionJsonSchema,
                    strict: true,
                },
            },
        };
    }
    extractText(response) {
        if ("output_text" in response &&
            typeof response.output_text === "string" &&
            response.output_text.trim().length > 0) {
            return response.output_text;
        }
        if ("output" in response) {
            for (const item of response.output ?? []) {
                if (!("content" in item) || !Array.isArray(item.content)) {
                    continue;
                }
                for (const contentItem of item.content) {
                    if (typeof contentItem === "object" &&
                        contentItem !== null &&
                        "type" in contentItem &&
                        contentItem.type === "output_text" &&
                        "text" in contentItem &&
                        typeof contentItem.text === "string") {
                        return contentItem.text;
                    }
                }
            }
        }
        throw new errors_1.AppError(502, "UPSTREAM_EMPTY_RESPONSE", "OpenAI returned no text output");
    }
}
exports.OpenAIResponsesClient = OpenAIResponsesClient;
