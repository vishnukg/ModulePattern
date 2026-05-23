# 06 — DynamoDB & the DB Interface

This doc explains how the project plugs in a real database (DynamoDB) without
touching the business logic. It also shows how to run everything locally with
LocalStack.

---

## The core idea: program to an interface

The `reserve` function never imports DynamoDB directly. It only knows about the
`DB` interface:

```ts
// src/modules/db/types.ts
export type DB = {
  saveReservation: (reservation: Reservation) => Promise<void>;
  getReservations: () => Promise<Reservation[]>;
};
```

That's it — two methods, both returning Promises. As long as something satisfies
this shape, `reserve` doesn't care whether the data lives in memory, DynamoDB,
PostgreSQL, or a text file.

This is the **Dependency Inversion Principle** expressed in TypeScript. High-level
code (business rules) depends on an abstraction, not a concrete implementation.

---

## Two implementations, same interface

### In-memory (tests and quick local runs)

```ts
// src/modules/db/makeInMemoryDb.ts
const makeInMemoryDb = ({ logger }: DBCfg): DB => {
  const reservations: Reservation[] = [];

  const saveReservation = async (reservation: Reservation): Promise<void> => {
    logger.info("saving reservation", reservation);
    reservations.push(reservation);
  };

  const getReservations = async (): Promise<Reservation[]> => [...reservations];

  return { saveReservation, getReservations };
};
```

Key things to notice:
- `[...reservations]` returns a **copy** of the array. Callers can't accidentally
  mutate the internal state.
- Both methods are `async` even though there's no real I/O. The interface is
  always async because real databases are async — we match that from day one so
  nothing needs to change when we swap implementations.

### DynamoDB (production / LocalStack)

```ts
// src/modules/db/makeDynamoDb.ts
const makeDynamoDb = ({ tableName, region, endpoint, logger }: DynamoDbCfg): DB => {
  const raw    = new DynamoDBClient({ region, ...(endpoint ? { endpoint } : {}) });
  const client = DynamoDBDocumentClient.from(raw);

  const saveReservation = async (reservation: Reservation): Promise<void> => {
    logger.info("saving reservation to DynamoDB", reservation);
    await client.send(new PutCommand({
      TableName: tableName,
      Item: { id: randomUUID(), ...reservation },
    }));
  };

  const getReservations = async (): Promise<Reservation[]> => {
    const result = await client.send(new ScanCommand({ TableName: tableName }));
    return (result.Items ?? []).map(item => ({
      quantity: item.quantity as number,
      date:     item.date    as string,
    }));
  };

  return { saveReservation, getReservations };
};
```

Key things to notice:
- `DynamoDBDocumentClient` (from `@aws-sdk/lib-dynamodb`) handles marshalling
  automatically — you send plain JS objects and get plain JS objects back. The
  lower-level `DynamoDBClient` works with DynamoDB's wire format (`{ S: "hello" }`
  etc.) which is verbose.
- Each reservation gets a random `id` (UUID) as its partition key. This lets you
  store multiple reservations for the same date/quantity without overwriting.
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

## Switching at the entry point (server.ts)

The composition root (`server.ts`) reads environment variables to decide which
implementation to use:

```ts
const db = process.env.DYNAMODB_TABLE
  ? makeDynamoDb({
      tableName: process.env.DYNAMODB_TABLE,
      region:    process.env.AWS_REGION ?? "us-east-1",
      endpoint:  process.env.DYNAMODB_ENDPOINT,
      logger,
    })
  : undefined; // falls back to makeInMemoryDb in compose.ts

const { restaurant } = makeApp({ restaurantCfg: { tableSize }, logger, db });
```

And in `compose.ts`, `makeInMemoryDb` is the default:

```ts
const makeApp = ({
  restaurantCfg,
  logger  = makeConsoleLogger(),
  metrics = makeNoOpMetrics(),
  db      = makeInMemoryDb({ logger }),  // ← default, used when db is undefined
}: MakeAppCfg) => { ... };
```

This pattern — **default parameters as defaults, env vars as switches** — keeps the
composition root readable and avoids if-else chains inside business logic.

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
DYNAMODB_TABLE=reservations DYNAMODB_ENDPOINT=http://localhost:4566 tsx src/server.ts
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
  saveReservation: async () => {},
  getReservations: async () => [],
};
```

Because `makeReserve` depends on the `DB` *interface*, not on `makeInMemoryDb` or
`makeDynamoDb` directly, the test can supply any object that has the right shape.
This is why the tests are fast (no I/O) and reliable (no network).

The `makeInMemoryDb` tests (`tests/inMemoryDb.test.ts`) verify the in-memory
implementation itself — that it stores data, returns copies, and isolates state
between instances.

Integration tests against a real DynamoDB (or LocalStack) are a natural next step
but are outside the scope of this learning project.

---

## Summary

| Layer         | File                        | What it does                              |
|---------------|-----------------------------|-------------------------------------------|
| Interface     | `src/modules/db/types.ts`   | Defines what a DB must be able to do      |
| In-memory impl | `makeInMemoryDb.ts`        | Fast, no deps — used in tests and by default |
| DynamoDB impl | `makeDynamoDb.ts`           | Real AWS storage via DocumentClient       |
| Wiring        | `src/compose.ts`            | Default = in-memory                       |
| Wiring (prod) | `src/server.ts`             | Env var switches to DynamoDB              |
| Local infra   | `docker-compose.yml`        | LocalStack container                      |
| Table setup   | `scripts/setup-local.sh`    | Creates the `reservations` table          |
