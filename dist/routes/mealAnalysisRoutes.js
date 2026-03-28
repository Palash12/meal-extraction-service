"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createMealAnalysisRoutes = createMealAnalysisRoutes;
const express_1 = require("express");
function createMealAnalysisRoutes(controller) {
    const router = (0, express_1.Router)();
    router.post("/v1/meals/analyze", controller.analyzeMeal);
    return router;
}
