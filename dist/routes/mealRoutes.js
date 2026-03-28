"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createMealRoutes = createMealRoutes;
const express_1 = require("express");
function createMealRoutes(controller) {
    const router = (0, express_1.Router)();
    router.post("/v1/meals/extract", controller.extractMeal);
    return router;
}
