import type { FakeMetrics } from "../../src/core/index.ts";

const makeFakeMetrics = (): FakeMetrics => {
  const counters: Record<string, number>   = {};
  const timings:  Record<string, number[]> = {};

  return {
    increment(name) {
      counters[name] = (counters[name] ?? 0) + 1;
    },
    timing(name, durationMs) {
      timings[name] = [...(timings[name] ?? []), durationMs];
    },
    getCounter(name) {
      return counters[name] ?? 0;
    },
    getTimings(name) {
      return timings[name] ?? [];
    },
  };
};

export default makeFakeMetrics;
