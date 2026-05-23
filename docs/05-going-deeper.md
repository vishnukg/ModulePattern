# Going Deeper

The `this` bug, clean code structure, and how immutability stays fast.

---

## 1. The `this` binding bug — and why functional code cannot have it

In JavaScript, `this` inside a regular method does not refer to the object
it was defined on. It refers to whatever called the method at runtime.
This is one of the most common sources of bugs in class-based code.

```ts
class ReservationService {
  private tableSize: number;

  constructor(tableSize: number) {
    this.tableSize = tableSize;
  }

  reserve(quantity: number) {
    return quantity <= this.tableSize ? "Accepted" : "Rejected";
  }
}

const service = new ReservationService(10);
service.reserve(8); // "Accepted" — this = service ✓
```

The moment you separate the method from the object, `this` is lost:

```ts
const reserve = service.reserve;
reserve(8); // TypeError: Cannot read properties of undefined (reading 'tableSize')
            // this = undefined in strict mode
```

This is not a contrived example. It happens constantly in real code:

```ts
setTimeout(service.reserve, 1000);   // this is lost
[8, 12, 15].map(service.reserve);    // this is lost
const { reserve } = service;
reserve(8);                          // this is lost
```

#### The common fixes — all workarounds

**`.bind()`**
```ts
const reserve = service.reserve.bind(service);
reserve(8); // works — but you must remember to call .bind() everywhere
```

**Arrow function class field** — captures `this` at construction time:
```ts
class ReservationService {
  reserve = (quantity: number) => { // arrow, not a method
    return quantity <= this.tableSize ? "Accepted" : "Rejected";
  };
}
```
Works, but creates a new function object per instance instead of sharing
one on the prototype — costs more memory at scale.

**Wrapper at the call site:**
```ts
setTimeout(() => service.reserve(8), 1000); // works but adds noise everywhere
```

All three fix a problem that should not exist in the first place.

#### Why functional code cannot have this bug

In the functional pattern there is no `this`. Dependencies live in a closure.
The function is a standalone value that carries everything it needs.

```ts
// after compose() wires it up:
const { reserve } = restaurant;

reserve({ quantity: 8, date: "2024-12-12" }); // ✓
setTimeout(reserve, 1000);                     // ✓
[r1, r2, r3].map(reserve);                    // ✓
const fn = reserve;
fn({ quantity: 8, date: "2024-12-12" });       // ✓
```

Every one of these works because `reserve` does not need any surrounding
context. `restaurantCfg`, `db`, `logger`, and `metrics` are sealed into the
closure — they travel with the function wherever it goes.

---

## 2. Clean code structure in this functional style

#### One function per file

Each file in `src/modules/` exports a single default curried function.
The filename is the function name.

```
src/modules/restaurant/reserve.ts       ← exports reserve
src/modules/db/saveReservation.ts       ← exports saveReservation
src/modules/logger/consoleLogger.ts     ← exports consoleLogger
src/modules/metrics/fakeMetrics.ts      ← exports fakeMetrics
```

If you want to find `reserve`, open `reserve.ts`. Never any ambiguity.

#### Types co-located with their module

Types live in a `types.ts` file next to the code that owns them.

```
src/modules/restaurant/
  reserve.ts    ← business logic
  types.ts      ← Reservation, RestaurantCfg, ReserveCfg
  index.ts      ← barrel

src/modules/logger/
  consoleLogger.ts
  silentLogger.ts
  types.ts      ← Logger interface
  index.ts
```

`logger/types.ts` owns `Logger` because `logger` is the module that defines
what a logger is. Other modules import `Logger` from there.

#### Barrel files for namespacing

Each `index.ts` collects the module's functions under a single name:

```ts
// src/modules/logger/index.ts
import consoleLogger from "./consoleLogger.ts";
import silentLogger from "./silentLogger.ts";
export default { consoleLogger, silentLogger };
```

Callers write `modules.logger.consoleLogger()` rather than importing the
file path directly. Namespacing makes large codebases scannable.

#### Modules never import each other

All dependencies flow through `compose.ts`. A module never imports another
module directly.

```
               compose.ts
              /     |      \
         modules.db  modules.logger  modules.restaurant
```

`reserve.ts` does not `import saveReservation`. It receives `db` as an
argument. This means you can test `reserve` without `saveReservation`
existing at all.

#### Infrastructure vs domain

```
src/
  modules/       ← domain — business logic lives here
  container.ts   ← infrastructure — the wiring mechanism
  compose.ts     ← infrastructure — the wiring itself
```

Domain code has no knowledge of the container. Infrastructure knows about
both and connects them.

#### Adding a new module — the exact steps

1. Create `src/modules/email/types.ts` — types owned by this module
2. Create `src/modules/email/sendConfirmation.ts` — one curried function
3. Create `src/modules/email/index.ts` — barrel
4. Add `email` to `src/modules/index.ts`
5. Add `.add("sendConfirmation", ...)` and `.add("email", ...)` to `compose.ts`
6. Update `ReserveCfg` if `reserve` needs to call `email`

The pattern is identical every time. No new concepts needed.

---

## 3. Immutability without performance hits

The concern: "if we never mutate and always create new objects, are we
copying large amounts of data on every operation?"

The answer is no — because **spread copies references, not values**.

#### References vs values

In JavaScript, objects are accessed via references — just a memory address,
8 bytes on a 64-bit system. When you spread an object, you copy its
references, not its data.

```ts
const address = { city: "London", postcode: "SW1A" }; // lives somewhere in memory

const user = { name: "Alice", address };  // address field = 8-byte pointer
                                          // NOT a copy of the address object

const updatedUser = { ...user, name: "Bob" };
// updatedUser.address === user.address  ← same reference
// only `name` is new — address was not touched
```

Spreading `user`: 2 reference copies = 16 bytes. The address object itself
was not moved or copied.

#### What the container actually copies

Each `.add()` call does:

```ts
const next = { ...(services as any), [name]: newService };
```

`newService` is a function — a reference. `services` is an object of references.

With 10 registered services (each an 8-byte function reference):

```
.add() #1  → copies 0 refs  →  1 ref stored
.add() #2  → copies 1 ref   →  2 refs stored
...
.add() #10 → copies 9 refs  → 10 refs stored

Total: 0+1+...+9 = 45 copies × 8 bytes = 360 bytes
```

360 bytes. Once. At startup. The 9 intermediate objects are garbage
collected after `.build()` returns — only the final object stays alive.

#### Structural sharing

The reason shallow copies are cheap is called **structural sharing**:
when you create a new version of an object, unchanged parts are shared
between the old and new version rather than copied.

```ts
const v1 = { a: bigObject, b: bigObject, c: bigObject };
const v2 = { ...v1, c: differentObject };

// v2.a === v1.a  ← shared, not copied
// v2.b === v1.b  ← shared, not copied
// v2.c           ← only this reference changed
```

`bigObject` could be 100MB and the spread still only costs 3 pointer copies.

#### When immutability does cost something

**Hot loops** — creating new arrays on every iteration of a tight loop:
```ts
// expensive — new array every iteration
const result = items.reduce((acc, x) => [...acc, transform(x)], []);

// better — allocates once
const result = items.map(transform);
```

**Deeply nested objects** — updating a value deep in a nested structure
requires copying every level on the path:
```ts
const updated = {
  ...state,
  deep: { ...state.deep, nested: { ...state.deep.nested, value: newValue } },
};
```

For this case, **Immer** gives you structural sharing automatically —
you write mutating code, Immer produces an immutable result using a
proxy that only copies what changed.

Neither case applies to this project. The container builds once at startup.
At runtime, `reserve` returns a plain string — nothing is copied at all.
