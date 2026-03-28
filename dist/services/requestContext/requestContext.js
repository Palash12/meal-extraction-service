"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requestContextMiddleware = requestContextMiddleware;
const crypto_1 = require("crypto");
function requestContextMiddleware(request, response, next) {
    const requestId = request.body?.request_id ?? request.header("x-request-id") ?? (0, crypto_1.randomUUID)();
    request.requestId = requestId;
    request.requestStartedAt = Date.now();
    response.setHeader("x-request-id", requestId);
    next();
}
