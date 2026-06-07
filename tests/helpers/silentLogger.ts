import type { Logger } from "../../src/restaurant/index.ts";

const makeSilentLogger = (): Logger => ({
    info: () => {},
    warn: () => {},
    error: () => {},
});

export default makeSilentLogger;
