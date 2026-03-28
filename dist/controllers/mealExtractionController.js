"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MealExtractionController = void 0;
const logger_1 = require("../lib/logger");
const mealRequest_1 = require("../schemas/mealRequest");
class MealExtractionController {
    mealExtractionService;
    constructor(mealExtractionService) {
        this.mealExtractionService = mealExtractionService;
    }
    extractMeal = async (request, response, next) => {
        try {
            const parsedRequest = mealRequest_1.MealExtractionRequestSchema.parse(request.body);
            const result = await this.mealExtractionService.extractMeal(parsedRequest);
            logger_1.logger.info("meal_extraction_completed", {
                request_id: request.requestId ?? parsedRequest.request_id,
                needs_user_confirmation: result.needs_user_confirmation,
            });
            response.status(200).json(result);
        }
        catch (error) {
            next(error);
        }
    };
}
exports.MealExtractionController = MealExtractionController;
