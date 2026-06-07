import type { Metrics } from "../../index.ts";

const makeNoOpMetrics = (): Metrics => ({
    increment: () => {},
    timing: () => {},
});

export default makeNoOpMetrics;
