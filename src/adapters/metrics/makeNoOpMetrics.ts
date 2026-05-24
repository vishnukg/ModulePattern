import type { Metrics } from "../../ports/metrics.ts";

const makeNoOpMetrics = (): Metrics => ({
  increment: () => {},
  timing:    () => {},
});

export default makeNoOpMetrics;
