import type { Logger } from "../../src/ports/index.ts";

const makeSilentLogger = (): Logger => ({
  info: () => {},
  warn: () => {},
  error: () => {},
});

export default makeSilentLogger;
