import type { Logger } from "../../src/modules/logger/types.ts";

const makeSilentLogger = (): Logger => ({
  info: () => {},
  warn: () => {},
  error: () => {},
});

export default makeSilentLogger;
