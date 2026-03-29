import express from "express";
import OpenAI from "openai";

import { ImageFetchClient } from "./clients/imageFetchClient";
import { OpenAIClient } from "./clients/openaiClient";
import { OpenAIResponsesClient } from "./clients/openaiResponsesClient";
import { env } from "./config/env";
import { MealAnalysisController } from "./controllers/mealAnalysisController";
import { MealExtractionController } from "./controllers/mealExtractionController";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler";
import { createMealAnalysisRoutes } from "./routes/mealAnalysisRoutes";
import { createMealRoutes } from "./routes/mealRoutes";
import { MealAnalysisOrchestrator } from "./pipeline/orchestrator/mealAnalysisOrchestrator";
import { featureFlags } from "./services/config/featureFlags";
import { demoObservability } from "./services/observability/demoObservability";
import { MealExtractionService } from "./services/mealExtractionService";
import { requestContextMiddleware } from "./services/requestContext/requestContext";

export interface AppDependencies {
  mealAnalysisOrchestrator?: MealAnalysisOrchestrator;
}

export function createApp(dependencies: AppDependencies = {}): express.Express {
  const app = express();

  app.use(express.json({ limit: "1mb" }));
  app.use(requestContextMiddleware);

  // TODO: Add authentication middleware here before exposing the service publicly.
  // TODO: Add request rate limiting here to protect the upstream model dependency.

  const orchestrator =
    dependencies.mealAnalysisOrchestrator ??
    (() => {
      const openai = new OpenAI({
        apiKey: env.OPENAI_API_KEY,
        // TODO: Replace direct env-based key loading with production secret management.
      });

      const openAIClient = new OpenAIClient(
        openai,
        {
          inferenceModel:
            featureFlags.inferenceModelOverride ?? env.OPENAI_MODEL,
          moderationModel: env.OPENAI_MODERATION_MODEL,
          maxOutputTokens: featureFlags.maxOutputTokensOverride,
        },
        {
          demoObservability,
          featureFlags,
        },
      );
      const imageFetchClient = new ImageFetchClient(
        {
          allowedSchemes: ["https"],
          redirectLimit: env.IMAGE_FETCH_REDIRECT_LIMIT,
          maxContentLengthBytes:
            featureFlags.maxFetchSizeMbOverride !== null
              ? Math.floor(featureFlags.maxFetchSizeMbOverride * 1024 * 1024)
              : env.IMAGE_FETCH_MAX_CONTENT_LENGTH_BYTES,
          connectionTimeoutMs:
            featureFlags.fetchTimeoutMsOverride ??
            env.IMAGE_FETCH_CONNECT_TIMEOUT_MS,
          readTimeoutMs:
            featureFlags.fetchTimeoutMsOverride ??
            env.IMAGE_FETCH_READ_TIMEOUT_MS,
          allowedContentTypes: ["image/jpeg", "image/png", "image/webp"],
        },
        demoObservability,
      );

      return new MealAnalysisOrchestrator({
        imageFetchClient,
        openAIClient,
        featureFlags,
      });
    })();
  const openai = new OpenAI({
    apiKey: env.OPENAI_API_KEY,
    // TODO: Replace direct env-based key loading with production secret management.
  });
  const analysisController = new MealAnalysisController(orchestrator);
  const extractionClient = new OpenAIResponsesClient(
    openai.responses,
    env.OPENAI_MODEL,
  );
  const extractionService = new MealExtractionService(extractionClient);
  const extractionController = new MealExtractionController(extractionService);

  app.use(createMealRoutes(extractionController));
  app.use(createMealAnalysisRoutes(analysisController));
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
