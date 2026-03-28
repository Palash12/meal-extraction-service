"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createApp = createApp;
const express_1 = __importDefault(require("express"));
const openai_1 = __importDefault(require("openai"));
const imageFetchClient_1 = require("./clients/imageFetchClient");
const openaiClient_1 = require("./clients/openaiClient");
const openaiResponsesClient_1 = require("./clients/openaiResponsesClient");
const env_1 = require("./config/env");
const mealAnalysisController_1 = require("./controllers/mealAnalysisController");
const mealExtractionController_1 = require("./controllers/mealExtractionController");
const errorHandler_1 = require("./middleware/errorHandler");
const mealAnalysisRoutes_1 = require("./routes/mealAnalysisRoutes");
const mealRoutes_1 = require("./routes/mealRoutes");
const mealAnalysisOrchestrator_1 = require("./pipeline/orchestrator/mealAnalysisOrchestrator");
const featureFlags_1 = require("./services/config/featureFlags");
const mealExtractionService_1 = require("./services/mealExtractionService");
const requestContext_1 = require("./services/requestContext/requestContext");
function createApp(dependencies = {}) {
    const app = (0, express_1.default)();
    app.use(express_1.default.json({ limit: "1mb" }));
    app.use(requestContext_1.requestContextMiddleware);
    // TODO: Add authentication middleware here before exposing the service publicly.
    // TODO: Add request rate limiting here to protect the upstream model dependency.
    const orchestrator = dependencies.mealAnalysisOrchestrator ??
        (() => {
            const openai = new openai_1.default({
                apiKey: env_1.env.OPENAI_API_KEY,
                // TODO: Replace direct env-based key loading with production secret management.
            });
            const openAIClient = new openaiClient_1.OpenAIClient(openai, {
                inferenceModel: env_1.env.OPENAI_MODEL,
                moderationModel: env_1.env.OPENAI_MODERATION_MODEL,
            });
            const imageFetchClient = new imageFetchClient_1.ImageFetchClient();
            return new mealAnalysisOrchestrator_1.MealAnalysisOrchestrator({
                imageFetchClient,
                openAIClient,
                featureFlags: featureFlags_1.featureFlags,
            });
        })();
    const openai = new openai_1.default({
        apiKey: env_1.env.OPENAI_API_KEY,
        // TODO: Replace direct env-based key loading with production secret management.
    });
    const analysisController = new mealAnalysisController_1.MealAnalysisController(orchestrator);
    const extractionClient = new openaiResponsesClient_1.OpenAIResponsesClient(openai.responses, env_1.env.OPENAI_MODEL);
    const extractionService = new mealExtractionService_1.MealExtractionService(extractionClient);
    const extractionController = new mealExtractionController_1.MealExtractionController(extractionService);
    app.use((0, mealRoutes_1.createMealRoutes)(extractionController));
    app.use((0, mealAnalysisRoutes_1.createMealAnalysisRoutes)(analysisController));
    app.use(errorHandler_1.notFoundHandler);
    app.use(errorHandler_1.errorHandler);
    return app;
}
