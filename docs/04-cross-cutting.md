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
dependency — define an interface, inject through `make*` deps, provide
different implementations for production and testing.

---

## 2. Defining the interfaces

`interface` is used here (rather than `type`) to signal that multiple
implementations will satisfy the same contract.

```ts
// src/core/ports/logger.ts
export interface Logger {
  info: (message: string, data?: Record<string, unknown>) => void;
  warn: (message: string, data?: Record<string, unknown>) => void;
  error: (message: string, data?: Record<string, unknown>) => void;
}

// src/core/ports/metrics.ts
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

**Console logger** — for production (`src/adapters/logger/consoleLogger.ts`):

```ts
export default (): Logger => ({
  info: (message, data) =>
    console.log(JSON.stringify({ level: "info", message, ...data })),
  warn: (message, data) =>
    console.warn(JSON.stringify({ level: "warn", message, ...data })),
  error: (message, data) =>
    console.error(JSON.stringify({ level: "error", message, ...data })),
});
```

**Silent logger** — for tests, suppresses all output (`tests/helpers/silentLogger.ts`):

```ts
const makeSilentLogger = (): Logger => ({
  info: () => {},
  warn: () => {},
  error: () => {},
});
```

**Fake metrics** — for tests, stores results in memory (`tests/helpers/fakeMetrics.ts`):

```ts
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
    getCounter(name) { return counters[name] ?? 0; },
    getTimings(name) { return timings[name] ?? []; },
  };
};
```

`makeFakeMetrics` follows the module pattern — state (`counters`, `timings`)
lives in a closure, hidden from the outside. The returned object is the only
way to interact with it.

Test helpers live in `tests/helpers/`, **not** in `src/`. Production code
has no knowledge they exist.

---

## 4. Injecting into a module

`reserve.ts` receives `logger` and `metrics` as part of its deps object
and calls them at the right moments:

```ts
const makeReserve = ({ db, restaurantCfg, logger, metrics }: ReserveCfg) => {
  const reserve = async ({ quantity, date }: ReservationInput) => {
    const start = Date.now();
    logger.info("reservation attempt", { quantity, date });

    if (quantity <= restaurantCfg.tableSize) {
      await db.saveReservation({ quantity, date });
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
  return reserve;
};
```

`reserve.ts` contains no `import` for any logging library. The business
logic (`quantity <= restaurantCfg.tableSize`) is unchanged. Cross-cutting
concerns are woven in via the deps object.

---

## 5. Wiring in compose

Each entry point creates its own infrastructure and passes it to its
composition root. The composition root wires everything together:

```ts
// src/server/index.ts — creates infrastructure
const logger  = makeConsoleLogger();
const metrics = makeNoOpMetrics();
const db      = makeInMemoryDb({ logger, generateId: randomUUID }); // or makeDynamoDb

// src/server/compose.ts — pure wiring, no defaults
const makeServerApp = ({ restaurantCfg, logger, metrics, db }: ServerAppCfg) => {
  const reserve = makeReserve({ db, logger, metrics, restaurantCfg });
  const cancel  = makeCancel({ db, logger, metrics });
  const update  = makeUpdate({ db, logger, metrics, restaurantCfg });
  ...
};
```

To swap the console logger for Pino or Winston, change one line in
`server/index.ts`. No module file needs to change.

Note: production uses `makeNoOpMetrics` (discards all metrics). To wire up
a real metrics sink (StatsD, DataDog), implement `Metrics` and pass it from
`server/index.ts` — nothing else changes.

---

## 6. Testing cross-cutting concerns

Create a `makeFakeMetrics()` instance before wiring, pass the same instance
in, and keep your reference. When `reserve` calls `metrics.increment(...)`,
it calls methods on *your* instance.

```ts
import makeFakeMetrics  from "./helpers/fakeMetrics.ts";
import makeSilentLogger from "./helpers/silentLogger.ts";
import { makeReserve } from "../src/core/index.ts";

it("increments reservation.accepted on a successful reservation", async () => {
  const metrics = makeFakeMetrics();
  const reserve = makeReserve({
    db: stubDb,
    restaurantCfg: { tableSize: 12 },
    logger: makeSilentLogger(),
    metrics,
  });

  await reserve({ quantity: 10, date: "2024-12-12" });

  expect(metrics.getCounter("reservation.accepted")).toBe(1);
  expect(metrics.getCounter("reservation.rejected")).toBe(0);
});
```

This works because of **structural typing**: `FakeMetrics extends Metrics`,
so TypeScript accepts it wherever `Metrics` is expected. You never need to
cast or use `as`.

You can also assert on timing:

```ts
it("records a timing for every attempt regardless of outcome", async () => {
  const metrics = makeFakeMetrics();
  const reserve = makeReserve({ db: stubDb, restaurantCfg: { tableSize: 12 }, logger: makeSilentLogger(), metrics });

  await reserve({ quantity: 10, date: "2024-12-12" });
  await reserve({ quantity: 13, date: "2024-12-12" });

  expect(metrics.getTimings("reservation.duration_ms")).toHaveLength(2);
});
```
