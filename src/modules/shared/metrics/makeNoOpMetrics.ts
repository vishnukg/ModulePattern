import type { Metrics } from "./types.ts";

const makeNoOpMetrics = (): Metrics => ({
  increment: () => {},
  timing:    () => {},
});

export default makeNoOpMetrics;
