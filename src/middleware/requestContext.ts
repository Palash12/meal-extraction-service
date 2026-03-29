import { randomUUID } from "crypto";
import type { NextFunction, Request, Response } from "express";

import { logger } from "../lib/logger";

declare global {
  namespace Express {
    interface Request {
      requestId?: string;
    }
  }
}

export function requestContextMiddleware(
  request: Request,
  response: Response,
  next: NextFunction,
): void {
  const requestId =
    request.body?.request_id ?? request.header("x-request-id") ?? randomUUID();
  request.requestId = requestId;
  response.setHeader("x-request-id", requestId);

  logger.info("incoming_request", {
    request_id: requestId,
    method: request.method,
    path: request.path,
  });

  next();
}
