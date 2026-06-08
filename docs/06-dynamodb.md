# 06 — DynamoDB & the DB Interface

This doc explains how the project plugs in a real database (DynamoDB) without
touching the business logic. It also shows how to run everything locally with
LocalStack.

---

## The core idea: program to an interface

The `reserve` function never imports DynamoDB directly. It only knows about the
`DB` interface:

```ts
// src/restaurant/ports/db.ts  ← a driven port the core owns
export interface DB {
    saveReservation: (input: ReservationInput) => Promise<Reservation>;
    getReservations: () => Promise<Reservation[]>;
    cancelReservation: (id: string) => Promise<boolean>;
    updateReservation: (id: string, input: ReservationInput) => Promise<Reservation | null>;
}
```

`DB` lives in `ports/db.ts` — not in `adapters/db/`. The core defines
what a database must be able to do; adapters satisfy that contract.
This is the **Inward Dependency Rule**: `adapters/` imports from the core
(`domain/` + `ports/`), never the other way around.

As long as something satisfies this shape, `reserve` doesn't care whether the
data lives in memory, DynamoDB, PostgreSQL, or a text file.

This is the **Dependency Inversion Principle** expressed in TypeScript. High-level
code (business rules) depends on an abstraction, not a concrete implementation.

---

## Two implementations, same interface

### In-memory (tests and quick local runs)

```ts
// src/restaurant/adapters/db/makeInMemoryDb.ts
type InMemoryDbCfg = { logger: Logger; generateId: () => string };

const makeInMemoryDb = ({ logger, generateId }: InMemoryDbCfg): DB => {
    const store: Reservation[] = [];

    const saveReservation = async (input: ReservationInput): Promise<Reservation> => {
        const reservation: Reservation = { id: generateId(), ...input };
        store.push(reservation);
        return reservation;
    };

    const getReservations = async (): Promise<Reservation[]> => [...store];

    const cancelReservation = async (id: string): Promise<boolean> => {
        const index = store.findIndex((r) => r.id === id);
        if (index === -1) return false;
        store.splice(index, 1);
        return true;
    };

    const updateReservation = async (
        id: string,
        input: ReservationInput,
    ): Promise<Reservation | null> => {
        const index = store.findIndex((r) => r.id === id);
        if (index === -1) return null;
        const updated: Reservation = { id, ...input };
        store[index] = updated;
        return updated;
    };

    return {
        saveReservation,
        getReservations,
        cancelReservation,
        updateReservation,
    };
};
```

Key things to notice:

- `saveReservation` generates a UUID and returns the full `Reservation` (with `id`).
  The caller (business logic) gets back the saved record — useful for responses.
- `[...store]` in `getReservations` returns a **copy** of the array. Callers can't
  accidentally mutate the internal state.
- `cancelReservation` returns `boolean` (found or not). The domain layer
  (`restaurant.cancel`) translates that into `"Cancelled" | "NotFound"` — the DB stays neutral.
- All methods are `async` even though there's no real I/O. The interface is always
  async because real databases are async — we match that from day one so nothing
  needs to change when we swap implementations.

### DynamoDB (production / LocalStack)

```ts
// src/restaurant/adapters/db/makeDynamoDb.ts
type DynamoDbCfg = {
    tableName: string;
    client: DynamoDBDocumentClient; // constructed and injected by server/index.ts
    logger: Logger;
    generateId: () => string;
};

const makeDynamoDb = ({ tableName, client, logger, generateId }: DynamoDbCfg): DB => {
    const saveReservation = async (input: ReservationInput): Promise<Reservation> => {
        const reservation: Reservation = { id: generateId(), ...input };
        await client.send(new PutCommand({ TableName: tableName, Item: reservation }));
        return reservation;
    };

    const getReservations = async (): Promise<Reservation[]> => {
        const result = await client.send(new ScanCommand({ TableName: tableName }));
        return (result.Items ?? []).map((item) => ({
            id: item.id as string,
            quantity: item.quantity as number,
            date: item.date as string,
        }));
    };

    const cancelReservation = async (id: string): Promise<boolean> => {
        const existing = await client.send(new GetCommand({ TableName: tableName, Key: { id } }));
        if (!existing.Item) return false;
        await client.send(new DeleteCommand({ TableName: tableName, Key: { id } }));
        return true;
    };

    const updateReservation = async (
        id: string,
        input: ReservationInput,
    ): Promise<Reservation | null> => {
        const existing = await client.send(new GetCommand({ TableName: tableName, Key: { id } }));
        if (!existing.Item) return null;
        const updated: Reservation = { id, ...input };
        await client.send(new PutCommand({ TableName: tableName, Item: updated }));
        return updated;
    };

    return {
        saveReservation,
        getReservations,
        cancelReservation,
        updateReservation,
    };
};
```

Key things to notice:

- `DynamoDBDocumentClient` (from `@aws-sdk/lib-dynamodb`) handles marshalling
  automatically — you send plain JS objects and get plain JS objects back. The
  lower-level `DynamoDBClient` works with DynamoDB's wire format (`{ S: "hello" }`
  etc.) which is verbose.
- Each reservation gets a random `id` (UUID) as its partition key. This lets you
  store multiple reservations for the same date/quantity without overwriting.
- `cancelReservation` uses `GetCommand` to check existence before `DeleteCommand` —
  DynamoDB's `DeleteCommand` silently succeeds even if the item doesn't exist, so
  we check first to return the correct boolean.
- The optional `endpoint` field lets you point the client at LocalStack instead of
  real AWS. When `endpoint` is `undefined`, the SDK connects to real AWS.

---

## Why async everywhere, even for in-memory?

Real I/O (network, disk) is non-blocking in Node.js and always returns a Promise.
If the `DB` interface were synchronous, you'd have to change `reserve` and every
test when you add a real database.

By making the interface async from the start:

- `reserve` uses `await db.saveReservation(...)` — works with any implementation.
- Tests use stub objects with `async () => {}` — no extra mocking needed.
- Swapping implementations requires zero changes to business logic.

---

## Switching at the entry point (server/index.ts)

The server entry point reads environment variables and decides which DB
implementation to create, then passes it to the composition root:

```ts
// src/server/index.ts  — all infrastructure decisions live here
const logger = makeConsoleLogger();
const metrics = makeNoOpMetrics();

const db: DB = (() => {
    if (!process.env.DYNAMODB_TABLE) return makeInMemoryDb({ logger, generateId: randomUUID });
    const region = process.env.AWS_REGION ?? "us-east-1";
    const endpoint = process.env.DYNAMODB_ENDPOINT;
    const raw = new DynamoDBClient({
        region,
        ...(endpoint ? { endpoint } : {}),
    });
    const client = DynamoDBDocumentClient.from(raw);
    return makeDynamoDb({
        tableName: process.env.DYNAMODB_TABLE,
        client,
        logger,
        generateId: randomUUID,
    });
})();

const { listen } = composeServerApp({ restaurantCfg: { tableSize }, logger, metrics, db, port });
listen();
```

`server/compose.ts` receives whatever db it is given — it has no defaults
and no knowledge of environment variables:

```ts
// src/server/compose.ts
const composeServerApp = ({ restaurantCfg, logger, metrics, db, port = 3000 }: ServerAppCfg) => {
  const restaurant = makeRestaurant({ db, logger, metrics, restaurantCfg });
  ...
};
```

This keeps infrastructure decisions (env vars, which concrete type to use)
at the entry point, and wiring logic in the composition root.

---

## Running locally with LocalStack

LocalStack is a local AWS emulator. It runs DynamoDB (and many other AWS services)
on your machine so you don't need an AWS account for development.

### 1. Start LocalStack

```bash
npm run local:up
```

This runs `docker compose up -d`, which starts a LocalStack container on port 4566.

### 2. Create the table

```bash
npm run local:setup
```

This runs `scripts/setup-local.sh`, which uses the AWS CLI to create the
`reservations` table. The table has a single partition key: `id` (a UUID string).

You need the AWS CLI installed (`brew install awscli`). The credentials don't
need to be real — LocalStack accepts anything:

```bash
export AWS_ACCESS_KEY_ID=test
export AWS_SECRET_ACCESS_KEY=test
```

### 3. Start the server with DynamoDB

```bash
npm run server:dynamo
```

This is equivalent to:

```bash
DYNAMODB_TABLE=reservations DYNAMODB_ENDPOINT=http://localhost:4566 node src/server/index.ts
```

### 4. Test it

```bash
# Make a reservation
curl -X POST http://localhost:3000/api/reservations \
  -H "Content-Type: application/json" \
  -d '{"quantity": 4, "date": "25/12/25"}'

# Read reservations back
curl http://localhost:3000/api/reservations
```

### 5. Stop LocalStack

```bash
npm run local:down
```

---

## Testing without DynamoDB

The unit tests don't use DynamoDB at all — they use stubs and mocks of the `DB`
interface:

```ts
// In reserve.test.ts
const stubDb: DB = {
    saveReservation: async (input) => ({ id: "stub-id", ...input }),
    getReservations: async () => [],
    cancelReservation: async () => true,
    updateReservation: async () => null,
};
```

Because `makeRestaurant` depends on the `DB` _interface_, not on `makeInMemoryDb` or
`makeDynamoDb` directly, the test can supply any object that has the right shape.
This is why the tests are fast (no I/O) and reliable (no network).

The `makeInMemoryDb` tests (`tests/inMemoryDb.test.ts`) verify the in-memory
implementation itself — that it stores data, returns copies, and isolates state
between instances.

Integration tests against a real DynamoDB (or LocalStack) are a natural next step
but are outside the scope of this learning project.

---

## Summary

| Layer          | File                         | What it does                                       |
| -------------- | ---------------------------- | -------------------------------------------------- |
| Interface      | `src/restaurant/ports/db.ts` | Defines what a DB must be able to do (driven port) |
| In-memory impl | `makeInMemoryDb.ts`          | Fast, no deps — used in tests and by default       |
| DynamoDB impl  | `makeDynamoDb.ts`            | Real AWS storage via DocumentClient                |
| Wiring         | `src/server/compose.ts`      | Wires domain operations together                   |
| Entry point    | `src/server/index.ts`        | Reads env vars, creates db, calls compose          |
| Local infra    | `docker-compose.yml`         | LocalStack container                               |
| Table setup    | `scripts/setup-local.sh`     | Creates the `reservations` table                   |
