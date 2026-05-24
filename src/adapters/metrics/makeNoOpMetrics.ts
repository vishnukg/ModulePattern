import type { Metrics } from "../../core/index.ts";

const makeNoOpMetrics = (): Metrics => ({
    increment: () => {},
    timing: () => {},
});

export default makeNoOpMetrics;
