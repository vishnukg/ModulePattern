import type { Logger } from "../../src/modules/shared/index.ts";

const makeSilentLogger = (): Logger => ({
  info: () => {},
  warn: () => {},
  error: () => {},
});

export default makeSilentLogger;
