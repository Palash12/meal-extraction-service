"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createStageTimer = createStageTimer;
function createStageTimer() {
    const starts = new Map();
    return {
        start: (stage) => {
            starts.set(stage, Date.now());
        },
        end: (stage) => {
            const startedAt = starts.get(stage) ?? Date.now();
            return Date.now() - startedAt;
        },
    };
}
