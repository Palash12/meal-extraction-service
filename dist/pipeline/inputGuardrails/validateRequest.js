"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateRequestInput = validateRequestInput;
const mealAnalysisRequest_1 = require("../../schemas/mealAnalysisRequest");
function validateRequestInput(request) {
    return mealAnalysisRequest_1.MealAnalysisRequestSchema.parse(request);
}
