# Cross-Cutting Concerns

How logging, metrics, and other system-wide behaviour are handled
without polluting business logic.

---

## 1. What is a cross-cutting concern?

A **cross-cutting concern** is behaviour that many parts of a system need
but that has nothing to do with the core business logic. Logging and metrics
are the most common examples. Authentication, caching, and tracing are others.

The challenge: if every module imports a logger directly, you can't swap it
out for tests, you can't silence it, and you can't easily change the
implementation later.

The functional solution: treat loggers and metrics exactly like any other
dependency — define an interface, inject through the container, provide
different implementations for production and testing.

---

## 2. Defining the interfaces

`interface` is used here (rather than `type`) to signal that multiple
implementations will satisfy the same contract.

```ts
// src/modules/logger/types.ts
export interface Logger {
  info: (message: string, data?: Record<string, unknown>) => void;
  warn: (message: string, data?: Record<string, unknown>) => void;
  error: (message: string, data?: Record<string, unknown>) => void;
}

// src/modules/metrics/types.ts
export interface Metrics {
  increment: (name: string) => void;
  timing: (name: string, durationMs: number) => void;
}

export interface FakeMetrics extends Metrics {
  getCounter: (name: string) => number;
  getTimings: (name: string) => number[];
}
```

These interfaces describe *what* the concern does, with no knowledge of
*how* it does it. `reserve.ts` knows about `Logger` and `Metrics` —
it knows nothing about consoles, StatsD, DataDog, or any specific tool.

`FakeMetrics extends Metrics` means it satisfies the `Metrics` contract
and can be passed anywhere `Metrics` is expected, while also exposing
inspection methods used in tests.

---

## 3. Concrete implementations

**Console logger** — for production:

```ts
// src/modules/logger/consoleLogger.ts
export default (): Logger => ({
  info: (message, data) =>
    console.log(JSON.stringify({ level: "info", message, ...data })),
  warn: (message, data) =>
    console.warn(JSON.stringify({ level: "warn", message, ...data })),
  error: (message, data) =>
    console.error(JSON.stringify({ level: "error", message, ...data })),
});
```

**Silent logger** — for tests, suppresses all output:

```ts
// src/modules/logger/silentLogger.ts
export default (): Logger => ({
  info: () => {},
  warn: () => {},
  error: () => {},
});
```

**Fake metrics** — for tests, stores results in memory:

```ts
// src/modules/metrics/fakeMetrics.ts
export default (): FakeMetrics => {
  const counters: Record<string, number> = {};
  const timings: Record<string, number[]> = {};

  return {
    increment(name) {
      counters[name] = (counters[name] ?? 0) + 1;
    },
    timing(name, durationMs) {
      timings[name] = [...(timings[name] ?? []), durationMs];
    },
    getCounter(name) { return counters[name] ?? 0; },
    getTimings(name) { return timings[name] ?? []; },
  };
};
```

`fakeMetrics` itself follows the module pattern — state (`counters`, `timings`)
lives in a closure, hidden from the outside. The returned object is the only
way to interact with it.

---

## 4. Injecting into a module

`reserve.ts` receives `logger` and `metrics` as part of its deps object
and calls them at the right moments:

```ts
export default ({ db, restaurantCfg, logger, metrics }: ReserveCfg) =>
  ({ quantity, date }: Reservation) => {
    const start = Date.now();
    logger.info("reservation attempt", { quantity, date });

    if (quantity <= restaurantCfg.tableSize) {
      db.saveReservation({ quantity, date });
      metrics.increment("reservation.accepted");
      metrics.timing("reservation.duration_ms", Date.now() - start);
      logger.info("reservation accepted", { quantity, date });
      return "Accepted";
    }

    metrics.increment("reservation.rejected");
    metrics.timing("reservation.duration_ms", Date.now() - start);
    logger.warn("reservation rejected", { quantity, date, tableSize: restaurantCfg.tableSize });
    return "Rejected";
  };
```

`reserve.ts` contains no `import` for any logging library. The business
logic (`quantity <= restaurantCfg.tableSize`) is unchanged. Cross-cutting
concerns are woven in via the deps object.

---

## 5. Wiring in compose

`logger` and `metrics` are registered first so every subsequent service
in the chain can receive them as deps:

```ts
export default ({ restaurantCfg, logger: loggerOverride, metrics: metricsOverride }: ComposeCfg) =>
  container()
    .add("logger",          () => loggerOverride  ?? modules.logger.consoleLogger())
    .add("metrics",         () => metricsOverride ?? modules.metrics.fakeMetrics())
    .add("saveReservation", ({ logger }) => modules.db.saveReservation({ logger }))
    .add("db",              ({ saveReservation }) => ({ saveReservation }))
    .add("reserve",         ({ db, logger, metrics }) => modules.restaurant.reserve({ db, logger, metrics, restaurantCfg }))
    .add("restaurant",      ({ reserve }) => ({ reserve }))
    .build();
```

`loggerOverride ?? modules.logger.consoleLogger()`:
- If the caller passes a logger (tests do), use it
- Otherwise default to console logger (production)

To swap the console logger for Pino or Winston, change one line here.
No module file needs to change.

---

## 6. Testing cross-cutting concerns

Create `fakeMetrics()` before `compose()`, pass the same instance in,
and keep your reference. When `reserve` calls `metrics.increment(...)`,
it calls methods on *your* instance.

```ts
it("increments reservation.accepted on a successful reservation", () => {
  const metrics = modules.metrics.fakeMetrics();
  const { restaurant } = compose({
    restaurantCfg: { tableSize: 12 },
    logger: modules.logger.silentLogger(),
    metrics,
  });

  restaurant.reserve({ quantity: 10, date: "12/12/12" });

  expect(metrics.getCounter("reservation.accepted")).toBe(1);
  expect(metrics.getCounter("reservation.rejected")).toBe(0);
});
```

This works because of **structural typing**: `FakeMetrics extends Metrics`,
so TypeScript accepts it wherever `Metrics` is expected. You never need to
cast or use `as`.

You can also assert on timing:

```ts
it("records a timing for every attempt regardless of outcome", () => {
  const metrics = modules.metrics.fakeMetrics();
  const { restaurant } = compose({
    restaurantCfg: { tableSize: 12 },
    logger: modules.logger.silentLogger(),
    metrics,
  });

  restaurant.reserve({ quantity: 10, date: "12/12/12" });
  restaurant.reserve({ quantity: 13, date: "12/12/12" });

  expect(metrics.getTimings("reservation.duration_ms")).toHaveLength(2);
});
```
