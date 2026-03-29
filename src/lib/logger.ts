export interface LogContext {
  [key: string]: unknown;
}

type LogLevel = "info" | "warn" | "error";

function log(level: LogLevel, message: string, context: LogContext = {}): void {
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

export const logger = {
  info: (message: string, context?: LogContext): void =>
    log("info", message, context),
  warn: (message: string, context?: LogContext): void =>
    log("warn", message, context),
  error: (message: string, context?: LogContext): void =>
    log("error", message, context),
};
