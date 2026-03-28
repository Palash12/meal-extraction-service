"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requestContextMiddleware = requestContextMiddleware;
const crypto_1 = require("crypto");
const logger_1 = require("../lib/logger");
function requestContextMiddleware(request, response, next) {
    const requestId = request.body?.request_id ?? request.header("x-request-id") ?? (0, crypto_1.randomUUID)();
    request.requestId = requestId;
    response.setHeader("x-request-id", requestId);
    logger_1.logger.info("incoming_request", {
        request_id: requestId,
        method: request.method,
        path: request.path,
    });
    next();
}
