import { randomUUID } from "crypto";
import type { NextFunction, Request, Response } from "express";

declare global {
  namespace Express {
    interface Request {
      requestId?: string;
      requestStartedAt?: number;
    }
  }
}

export function requestContextMiddleware(
  request: Request,
  response: Response,
  next: NextFunction,
): void {
  const requestId = request.body?.request_id ?? request.header("x-request-id") ?? randomUUID();
  request.requestId = requestId;
  request.requestStartedAt = Date.now();
  response.setHeader("x-request-id", requestId);
  next();
}
