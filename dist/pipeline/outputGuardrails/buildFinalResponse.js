"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildFinalResponse = buildFinalResponse;
function buildFinalResponse(request, inference, output) {
    const clarifyingQuestion = output.abstained && output.reason === "MEDICAL_ADVICE_BLOCKED"
        ? null
        : output.clarifyingQuestion;
    return {
        requestId: request.request_id ?? "unknown",
        status: output.status,
        confidence: inference.confidence,
        detectedItems: inference.detectedItems,
        nutritionEstimate: inference.nutritionEstimate,
        uncertaintyNotes: inference.uncertaintyNotes,
        clarifyingQuestion,
        policyFlags: output.policyFlags,
        abstained: output.abstained,
        reason: output.reason,
    };
}
