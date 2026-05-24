import type { Logger } from "../../src/core/index.ts";

const makeSilentLogger = (): Logger => ({
    info: () => {},
    warn: () => {},
    error: () => {},
});

export default makeSilentLogger;
