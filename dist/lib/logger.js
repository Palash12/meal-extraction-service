"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.logger = void 0;
function log(level, message, context = {}) {
    const entry = {
        timestamp: new Date().toISOString(),
        level,
        message,
        ...context,
    };
    const serialized = JSON.stringify(entry);
    if (level === "error") {
        console.error(serialized);
        return;
    }
    if (level === "warn") {
        console.warn(serialized);
        return;
    }
    console.log(serialized);
}
exports.logger = {
    info: (message, context) => log("info", message, context),
    warn: (message, context) => log("warn", message, context),
    error: (message, context) => log("error", message, context),
};
