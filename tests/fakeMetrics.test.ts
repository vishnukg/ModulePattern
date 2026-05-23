import { describe, it, expect } from "vitest";
import fakeMetrics from "../src/modules/metrics/fakeMetrics.ts";

describe("fakeMetrics — counters", () => {
  it("returns 0 for an unrecorded counter", () => {
    expect(fakeMetrics().getCounter("unknown")).toBe(0);
  });

  it("increment increases the counter by 1", () => {
    const m = fakeMetrics();
    m.increment("hits");
    expect(m.getCounter("hits")).toBe(1);
  });

  it("increment accumulates across multiple calls", () => {
    const m = fakeMetrics();
    m.increment("hits");
    m.increment("hits");
    m.increment("hits");
    expect(m.getCounter("hits")).toBe(3);
  });

  it("counters for different names are independent", () => {
    const m = fakeMetrics();
    m.increment("a");
    m.increment("a");
    m.increment("b");
    expect(m.getCounter("a")).toBe(2);
    expect(m.getCounter("b")).toBe(1);
  });
});

describe("fakeMetrics — timings", () => {
  it("returns empty array for an unrecorded timing", () => {
    expect(fakeMetrics().getTimings("unknown")).toEqual([]);
  });

  it("timing records a duration", () => {
    const m = fakeMetrics();
    m.timing("response_ms", 42);
    expect(m.getTimings("response_ms")).toEqual([42]);
  });

  it("multiple timings are stored in order", () => {
    const m = fakeMetrics();
    m.timing("response_ms", 10);
    m.timing("response_ms", 25);
    m.timing("response_ms", 5);
    expect(m.getTimings("response_ms")).toEqual([10, 25, 5]);
  });

  it("timings for different names are independent", () => {
    const m = fakeMetrics();
    m.timing("a_ms", 100);
    m.timing("b_ms", 200);
    expect(m.getTimings("a_ms")).toEqual([100]);
    expect(m.getTimings("b_ms")).toEqual([200]);
  });
});

describe("fakeMetrics — isolation", () => {
  it("two instances do not share state", () => {
    const m1 = fakeMetrics();
    const m2 = fakeMetrics();

    m1.increment("hits");
    m1.timing("ms", 10);

    expect(m2.getCounter("hits")).toBe(0);
    expect(m2.getTimings("ms")).toEqual([]);
  });
});
