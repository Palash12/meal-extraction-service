"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MealAnalysisController = void 0;
const logger_1 = require("../services/logging/logger");
class MealAnalysisController {
    orchestrator;
    constructor(orchestrator) {
        this.orchestrator = orchestrator;
    }
    analyzeMeal = async (request, response, next) => {
        try {
            const payload = await this.orchestrator.analyze(request.body, request.requestId);
            logger_1.logger.requestCompleted({
                request_id: payload.requestId,
                http_status: 200,
                result_status: payload.status,
                total_latency_ms: Date.now() - (request.requestStartedAt ?? Date.now()),
                abstained: payload.abstained,
                policy_flag_count: payload.policyFlags.length,
            });
            response.status(200).json(payload);
        }
        catch (error) {
            next(error);
        }
    };
}
exports.MealAnalysisController = MealAnalysisController;
