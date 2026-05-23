import type { Logger } from "./types.ts";

export default (): Logger => ({
  info: (message, data) =>
    console.log(JSON.stringify({ level: "info", message, ...data })),
  warn: (message, data) =>
    console.warn(JSON.stringify({ level: "warn", message, ...data })),
  error: (message, data) =>
    console.error(JSON.stringify({ level: "error", message, ...data })),
});
