import type { Logger } from "../../ports/logger.ts";

const makeConsoleLogger = (): Logger => ({
  info: (message, data) =>
    console.log(JSON.stringify({ level: "info", message, ...data })),
  warn: (message, data) =>
    console.warn(JSON.stringify({ level: "warn", message, ...data })),
  error: (message, data) =>
    console.error(JSON.stringify({ level: "error", message, ...data })),
});

export default makeConsoleLogger;
