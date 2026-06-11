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
// src/restaurant/ports/logger.ts
export interface Logger {
    info: (message: string, data?: Record<string, unknown>) => void;
    warn: (message: string, data?: Record<string, unknown>) => void;
    error: (message: string, data?: Record<string, unknown>) => void;
}

// src/restaurant/ports/metrics.ts
export interface Metrics {
    increment: (name: string) => void;
    timing: (name: string, durationMs: number) => void;
}

export interface FakeMetrics extends Metrics {
    getCounter: (name: string) => number;
    getTimings: (name: string) => number[];
}
```

These interfaces describe _what_ the concern does, with no knowledge of
_how_ it does it. `makeRestaurant` knows about `Logger` and `Metrics` —
it knows nothing about consoles, StatsD, DataDog, or any specific tool.

`FakeMetrics extends Metrics` means it satisfies the `Metrics` contract
and can be passed anywhere `Metrics` is expected, while also exposing
inspection methods used in tests.

---

## 3. Concrete implementations

**Console logger** — for production (`src/restaurant/adapters/logger/makeConsoleLogger.ts`):

```ts
export default (): Logger => ({
    info: (message, data) => console.log(JSON.stringify({ level: "info", message, ...data })),
    warn: (message, data) => console.warn(JSON.stringify({ level: "warn", message, ...data })),
    error: (message, data) => console.error(JSON.stringify({ level: "error", message, ...data })),
});
```

**Silent logger** — for tests, suppresses all output (`tests/helpers/makeSilentLogger.ts`):

```ts
const makeSilentLogger = (): Logger => ({
    info: () => {},
    warn: () => {},
    error: () => {},
});
```

**Fake metrics** — for tests, stores results in memory (`tests/helpers/makeFakeMetrics.ts`):

```ts
const makeFakeMetrics = (): FakeMetrics => {
    const counters: Record<string, number> = {};
    const timings: Record<string, number[]> = {};

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
```

`makeFakeMetrics` follows the module pattern — state (`counters`, `timings`)
lives in a closure, hidden from the outside. The returned object is the only
way to interact with it.

Test helpers live in `tests/helpers/`, **not** in `src/`. Production code
has no knowledge they exist.

---

## 4. Injecting into a module

`makeRestaurant` receives `logger` and `metrics` as part of its deps object
and its operations call them at the right moments:

```ts
const makeRestaurant = ({ db, restaurantCfg, logger, metrics }: MakeRestaurantCfg) => {
    const reserve = async ({ quantity, date }: ReservationInput) => {
        const start = Date.now();
        logger.info("reservation attempt", { quantity, date });

        if (quantity <= restaurantCfg.tableSize) {
            await db.saveReservation({ quantity, date });
            metrics.increment("reservation.reserve.accepted");
            metrics.timing("reservation.reserve.duration_ms", Date.now() - start);
            logger.info("reservation accepted", { quantity, date });
            return "Accepted";
        }

        metrics.increment("reservation.reserve.rejected");
        metrics.timing("reservation.reserve.duration_ms", Date.now() - start);
        logger.warn("reservation rejected", {
            quantity,
            date,
            tableSize: restaurantCfg.tableSize,
        });
        return "Rejected";
    };
    // ... cancel, update, getReservations defined the same way ...
    return { reserve, cancel, update, getReservations };
};
```

`makeRestaurant` contains no `import` for any logging library. The business
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
const composeServerApp = ({ restaurantCfg, logger, metrics, db, port = 3000 }: ServerAppCfg) => {
  const restaurant = makeRestaurant({ db, logger, metrics, restaurantCfg });
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
it calls methods on _your_ instance.

```ts
import makeFakeMetrics from "./helpers/makeFakeMetrics.ts";
import makeSilentLogger from "./helpers/makeSilentLogger.ts";
import { makeRestaurant } from "../src/restaurant/index.ts";

it("increments reservation.reserve.accepted on a successful reservation", async () => {
    const metrics = makeFakeMetrics();
    const { reserve } = makeRestaurant({
        db: stubDb,
        restaurantCfg: { tableSize: 12 },
        logger: makeSilentLogger(),
        metrics,
    });

    await reserve({ quantity: 10, date: "2024-12-12" });

    expect(metrics.getCounter("reservation.reserve.accepted")).toBe(1);
    expect(metrics.getCounter("reservation.reserve.rejected")).toBe(0);
});
```

This works because of **structural typing**: `FakeMetrics extends Metrics`,
so TypeScript accepts it wherever `Metrics` is expected. You never need to
cast or use `as`.

You can also assert on timing:

```ts
it("records a timing for every attempt regardless of outcome", async () => {
    const metrics = makeFakeMetrics();
    const { reserve } = makeRestaurant({
        db: stubDb,
        restaurantCfg: { tableSize: 12 },
        logger: makeSilentLogger(),
        metrics,
    });

    await reserve({ quantity: 10, date: "2024-12-12" });
    await reserve({ quantity: 13, date: "2024-12-12" });

    expect(metrics.getTimings("reservation.reserve.duration_ms")).toHaveLength(2);
});
```

---

## 7. Error handling

Production systems distinguish two kinds of failures:

- **Business failures** — the request was valid but the domain said no. `"Rejected"`,
  `"NotFound"` etc. These are returned as typed values. No exceptions, no surprises.
- **Infrastructure failures** — the DB is down, the network timed out, an AWS call
  throttled. These are unexpected; they throw.

Each pattern has its own handling layer.

### Business failures (typed results)

Domain operations return a discriminated union instead of throwing:

```ts
// "Accepted" | "Rejected", "Cancelled" | "NotFound", "Updated" | "Rejected" | "NotFound"
const result = await restaurant.reserve({ quantity, date });
```

The HTTP adapter maps these cleanly to status codes with no try/catch needed:

```ts
res.status(result === "Accepted" ? 201 : 422).json({ result });
```

### Infrastructure failures (thrown errors)

Domain operations wrap every DB call in a try/catch. On failure they:

1. Increment an error metric (`reservation.reserve.error`, `reservation.cancel.error`, …)
2. Record a timing so dashboards stay accurate even on the error path
3. Call `logger.error` with the operation context (id, quantity, date, message)
4. Re-throw so the error propagates to the transport layer

```ts
try {
    await db.saveReservation({ quantity, date });
} catch (err) {
    metrics.increment("reservation.reserve.error");
    metrics.timing("reservation.reserve.duration_ms", Date.now() - start);
    logger.error("db error saving reservation", {
        quantity,
        date,
        message: errorMessage(err),
    });
    throw err;
}
```

(`errorMessage`, in `src/shared/errorMessage.ts`, narrows the `unknown` that
`catch` gives you — `err instanceof Error ? err.message : String(err)` — in one
place instead of at every catch site.)

### HTTP error boundary

`makeRestaurantServer` registers Express error middleware after the router.
Express 5 forwards a rejected promise from an async route handler to that
middleware automatically — no try/catch or wrapper needed in the router:

```ts
// Error middleware in makeRestaurantServer.ts
app.use((err, req, res, _next) => {
    logger.error("request failed", {
        method: req.method,
        path: req.path,
        message: errorMessage(err),
    });
    res.status(500).json({ error: "Internal server error" });
});
```

Two log lines appear for every infrastructure failure — one from the domain
(with operation context) and one from the middleware (with HTTP context). They
complement each other: the domain log tells you what failed; the middleware log
tells you which request triggered it.

The client always receives `{ error: "Internal server error" }`. Internal
details are never leaked in the response.

### Process-level safety net

`server/index.ts` registers `unhandledRejection` and `uncaughtException`
handlers before the server starts. Any rejection that escapes every other
boundary is logged and causes a clean `process.exit(1)` so the process
manager (Docker, Kubernetes, PM2) can restart the service rather than leaving
it in an unknown state.

### Input validation

The HTTP router validates inputs at the boundary before the domain ever sees them:

- `quantity` must be a positive integer (not zero, not negative, not a float)
- `date` must be a non-empty, non-whitespace string

Invalid input returns `400` immediately. The domain only receives data that has
already passed this check, which means domain code never needs defensive guards
against obviously-wrong inputs.
