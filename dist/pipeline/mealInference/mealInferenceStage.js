"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.runMealInference = runMealInference;
async function runMealInference(openAIClient, request) {
    return openAIClient.inferMeal(request);
}
