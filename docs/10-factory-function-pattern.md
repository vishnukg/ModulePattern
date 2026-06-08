# The Factory Function Pattern

The pattern this project uses has a formal name. Understanding it helps you
read unfamiliar code faster and reason about trade-offs clearly.

---

## What the pattern is called

The code in this repo follows the **Factory Function with Closure-Based
Dependency Injection** pattern. You will also see it called:

- **Functional Dependency Injection** (emphasises the FP origin)
- **Module Factory Pattern** (emphasises the module boundary it creates)
- **Closure-Based DI** (shorthand among practitioners)

It is a deliberate evolution of the older **Revealing Module Pattern** —
same closure idea, but reusable: you can call the factory many times to get
independent instances.

The `class` keyword does not appear in this project. This is not an accident.

---

## The two-call shape

Every factory in this project has the same structure:

```
make*(dependencies)  →  { operation }
                              ↓
                        operation(runtimeArgs)  →  result
```

The factory is called **once** at startup (wiring time) to capture
dependencies in a closure. The returned operation is called **many times**
at runtime, once per request or event.

```ts
// Wiring time — called once in compose.ts
const restaurant = makeRestaurant({ db, restaurantCfg, logger, metrics });

// Runtime — called once per HTTP request
await restaurant.reserve({ quantity: 2, date: "2024-12-01" });
```

This separates two very different concerns:

| Phase        | When        | Who calls it            |
| ------------ | ----------- | ----------------------- |
| Construction | Startup     | `compose.ts`            |
| Operation    | Per request | HTTP handler, test, CLI |

---

## The mental model: it's a tree

The whole app is a dependency tree. The one core idea behind everything below:
**separate _what each piece does_ from _how the pieces are connected_ — and never
let a piece reach out for its own dependencies; they are always handed to it.**

`make*` answers "what does this one thing do?" `compose*` answers "how are the
things wired together?" That single split is the entire pattern. Here is the tree
for this project, from the real world (top) down to the actual work (bottom):

```text
      THE REAL WORLD   (env vars, which DB?, sockets, process start)
            │
            ▼
┌────────────────────────────────────────────────────────────────────────┐
│  index.ts   --   TRUNK  (the entry point)                              │
│  - picks the concrete adapters: makeInMemoryDb, makeConsoleLogger ...  │
│  - calls the top branch, then runs it:  listen()                       │
└────────────────────────────────────────────────────────────────────────┘
            │   dependencies handed DOWN
            ▼
composeServerApp             BRANCH  (composition root)  →  returns { listen }
├─ makeRestaurant            leaf  (the domain — reserve/cancel/update/list inline)
├─ makeRestaurantRouter      leaf
└─ makeRestaurantServer      leaf
```

`makeRestaurant` is a single leaf: it closes over `db`/`logger`/`metrics` and
defines all four operations (`reserve`, `cancel`, `update`, `getReservations`)
as methods inline. It calls no other factory, so the tree stops there.

Two things flow along the tree, in opposite directions and at different times —
this is the [two-call shape](#the-two-call-shape) seen from above:

```text
WIRING TIME  (once, at startup):      dependencies flow DOWN
    trunk  →  branches  →  leaves      (db, logger handed downward)

RUNTIME  (per request, many times):   a request flows IN, a result comes back
    reserve({ quantity, date })  →  "Accepted"
```

### Leaf vs branch vs trunk

The tree metaphor maps almost perfectly — and it's the quickest way to _feel_
the rule before reading its precise form below.

**🍃 Leaf = `make*` — does the actual work.**

- A leaf is where photosynthesis happens: it turns inputs into something useful.
  `makeRestaurant` turns a booking into `"Accepted"` / `"Rejected"`.
- It is **fed, it doesn't forage.** A leaf has water and light delivered to it; it
  never goes looking. `makeRestaurant` is _handed_ `db` / `logger`; it never imports
  a concrete database.
- It is **terminal** — nothing grows past a leaf. A `make*` calls **no other
  factory**; it's where the tree stops. (This is exactly what `npm run audit`
  checks.)
- Leaves share one shape: `(deps) => capability`. `makeRestaurant`, `makeInMemoryDb`,
  `makeRestaurantRouter` — same silhouette, different work.

**🌿 Branch = `compose*` — connects, but does no work of its own.**

- A branch doesn't photosynthesize; it **holds leaves in position** and channels
  resources to them. `composeServerApp` invents no behaviour — it arranges
  behaviour that leaves already provide.
- A branch **can carry branches**: if a sub-tree ever needs its own composition
  step, a `compose*` may call another `compose*`. The tree nests to any depth.
- Its entire reason to exist is **connection**. Break a leaf and the app loses a
  capability; break a branch and the pieces are fine — they're just no longer
  joined.

**🪵 Trunk = entry point (`index.ts`) — where the tree meets the ground.**

- The trunk is the only part touching **soil**: env vars, _which_ database,
  _which_ logger, starting the process.
- It **chooses the concrete reality**, hands it up the tree, then lets everything
  run. Above the trunk nothing knows whether the DB is in-memory or DynamoDB —
  only the _port_ (the shape), never the concrete thing.

**🍂 Plain functions = not part of the tree at all.**

- `formatReport`, a validator, a data transform — these aren't factories and hold
  no dependencies. They're tools applied to data _flowing through_ the tree, which
  is why they get **no** `make*` / `compose*` prefix.

Two rules we follow elsewhere fall straight out of this picture: a branch hands up
only the capability the trunk runs (**return only what's driven** — never dangle
the whole sub-tree out the side), and the trunk owns concreteness (**adapter
selection lives in `index.ts`**, so everything above depends on ports).

---

## make vs compose: when to use which

Both `make*` and `compose*` are factory functions — you call them once at
startup and they return something you use later. The prefix tells you the
function's **job**. Here is the entire rule.

**`make*` = manufacture ONE thing.**
A `make*` takes its dependencies (already built) and returns a single **port** —
one function, or one object that implements one interface. It writes its logic
**inline**; it does not call other factories to assemble itself. It is a _leaf_:
the place a capability is actually defined.

**`compose*` = assemble things that already exist.**
A `compose*` **calls other factories** (`make*`, and sometimes other `compose*`)
and/or **chooses which concrete adapter to use**, then wires the results
together. It defines no new behaviour of its own — it connects behaviour that
`make*` functions already provide. It is a _branch_.

### The one test that decides it

Open the function body and ask:

> **Does it call another factory (`make*` / `compose*`) to build one of its parts?**
>
> - **No** → it's a **`make*`**. (Its work is written inline.)
> - **Yes** → it's a **`compose*`**. (It assembles other factories.)

That is the whole rule. The **return type does not matter**: a `make*` may return
a single function (one operation) or a multi-method object (a whole port); a
`compose*` may return one assembled port or a bag of peers. What makes it a compose
is _calling other factories_, not what it returns.

The clearest contrast is `makeRestaurant` (a leaf) vs `composeServerApp` (a branch):

```ts
// make: defines all its work INLINE → calls no factory → leaf
const makeRestaurant = ({ db, logger, metrics, restaurantCfg }): Restaurant => {
    const reserve = async (input) => {
        /* capacity rule, db.saveReservation, metrics, logging — written here */
    };
    const cancel = async (id) => {
        /* ... */
    };
    const update = async (id, input) => {
        /* ... */
    };
    const getReservations = async () => {
        /* ... */
    };
    return { reserve, cancel, update, getReservations };
};

// compose: it BUILDS its parts via other factories, then wires them → branch
const composeServerApp = ({ db, logger, metrics, restaurantCfg, port }) => {
    const restaurant = makeRestaurant({ db, logger, metrics, restaurantCfg });
    const router = makeRestaurantRouter({ restaurant });
    const app = makeRestaurantServer({ router, logger });
    return { listen: (onReady) => app.listen(port, () => onReady(port)) };
};
```

|                      | `makeRestaurant`                           | `composeServerApp`                             |
| -------------------- | ------------------------------------------ | ---------------------------------------------- |
| **Takes in**         | raw infrastructure (`db`, `logger`, `cfg`) | the same infrastructure                        |
| **Does**             | defines the four operations **inline**     | **builds** restaurant + router + server, wires |
| **Returns**          | a `Restaurant` (noun)                      | a `{ listen }` bag the entry point drives      |
| **Calls a factory?** | no → it's a **`make`** (leaf)              | yes → it's a **`compose`** (branch)            |

### Naming: make\* is a noun, its methods are verbs

The prefix has a grammar that makes new names write themselves:

- **`make*` is named for the noun it produces.** `makeRestaurant` → `Restaurant`,
  `makeInMemoryDb` → `DB`, `makeRestaurantRouter` → `Router`. Never name a `make*`
  after a verb — there is no `makeReserve`, because "reserve" is an action, not a
  thing you construct.
- **Verbs live inside, as methods.** `reserve`, `cancel`, `update`,
  `getReservations` are methods on the `Restaurant` noun — exactly like
  `array.push()` or `map.get()`. A verb method is always correct; a verb factory
  never is.
- **`compose*` is named for what it assembles** — usually an _App_
  (`composeServerApp`, `composeCliApp`), since its job is to wire one entry point.

So the question "what do I call this?" reduces to: _what noun does it produce?_
Prefix that noun with `make`. If instead it wires other factories together, it's a
`compose*` named for the app it assembles.

### The domain is one module — operations are its methods

`makeRestaurant` defines all four operations in **one** closure rather than four
separate `make*` factories. That is deliberate:

- **One factory, one noun.** The domain _is_ the `Restaurant`. Its operations are
  verbs that belong to it, so they live inside it as methods — not as four
  standalone nouns that then have to be re-bundled.
- **One rule to apply.** "Build the noun; verbs are its methods." There is no
  second decision about whether each operation gets its own file, its own factory,
  or a pass-through wrapper.
- **The seam is already there.** When an operation needs more — a filter on
  `getReservations`, a new dependency on `update` — you add it _inside_
  `makeRestaurant`; every call site stays unchanged because they only ever touched
  `restaurant.update(...)`.

The trade-off is honest: you can no longer construct a single operation in
isolation (`makeReserve(...)`) — you build the whole `Restaurant` and call the one
method. In practice tests do exactly that (`const { reserve } = makeRestaurant(...)`),
and the gain is fewer files and a single naming rule. (The alternative — one `make*`
per operation, assembled by a `composeRestaurant` — is equally valid; this project
chose the single-module form for simplicity.)

### This repo, function by function

| Function                                                                                                                                      | Kind       | Why                                                                     |
| --------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | ----------------------------------------------------------------------- |
| `makeRestaurant`                                                                                                                              | `make*`    | defines `reserve`/`cancel`/`update`/`getReservations` inline → leaf     |
| `makeInMemoryDb`, `makeDynamoDb`, `makeRestaurantRouter`, `makeRestaurantCli`, `makeRestaurantServer`, `makeConsoleLogger`, `makeNoOpMetrics` | `make*`    | each defines its behaviour inline → leaf                                |
| `composeServerApp`, `composeCliApp`                                                                                                           | `compose*` | call `makeRestaurant` + a driving adapter, return the entry point's bag |

### A third kind: plain functions

Not every function is a factory. A function that takes data and returns data — a
transform, a formatter, a validator — is just an ordinary function. Don't give
it a `make*` / `compose*` prefix. Those prefixes are **only** for the wiring
layer: building and connecting the ports your app depends on.

### This rule is enforced, not just documented

`npm run audit` (`scripts/audit-factories.mjs`) scans every `.ts` file and fails
the build if a `make*` builds a collaborator (it should be `compose*`) or a
`compose*` builds nothing (it should be `make*`). It runs in CI via `make ci`.
The script exists because this boundary is otherwise kept only by discipline —
see [When to choose something else](#when-to-choose-something-else) for patterns
that move the same guarantee into the compiler instead.

---

## Why this beats classes for this use case

From the _outside_, a factory and a class look the same — both hand you an object
whose methods you call. That similarity is the point: the consumer only sees the
`Restaurant` port and doesn't care how it was built. The differences are all in
**construction and internal mechanics**, and for dependency-injected, long-lived
services they fall the factory's way. The honest framing is not "factories beat
classes" — it's "factories drop the three things classes drag along (`this`,
`new`, inheritance) that this use case doesn't need."

A class mixes construction and operation through a shared `this`:

```ts
class Restaurant {
    constructor(
        private db: DB,
        private cfg: RestaurantCfg,
    ) {}

    async reserve(input: ReservationInput) {
        await this.db.saveReservation(input); // ← reaches deps via `this`
    }
}
```

A factory captures deps in a closure instead:

```ts
const makeRestaurant = ({ db, restaurantCfg }: MakeRestaurantCfg) => {
    const reserve = async (input: ReservationInput) => {
        await db.saveReservation(input); // ← reaches deps via closure — no `this`
    };
    return { reserve /* , cancel, update, getReservations */ };
};
```

### 1. No `this`-binding bugs — and this repo's tests rely on it

`this` is bound by _how a method is called_, not where it's defined. Detach a
class method from its instance and it breaks:

```ts
const r = new Restaurant(db, cfg);
const { reserve } = r; // detached from the instance
await reserve(input); // 💥 TypeError: cannot read 'saveReservation' of undefined
```

You'd need `r.reserve.bind(r)`, or to always call `r.reserve(...)`. Every time a
method is passed as a callback — `arr.map(r.reserve)`, an Express handler, an event
listener — you're exposed to this.

The factory has no such failure mode, which is exactly why the tests in this repo
can write:

```ts
const { reserve } = makeRestaurant({ db, logger, metrics, restaurantCfg });
await reserve({ quantity: 8, date: "12/12/12" }); // ✓ closure, not `this`
```

### 2. Genuinely private dependencies

In the factory, `db` and `logger` live in the closure — there is no
`restaurant.db`, ever. With a class, `private db` is only a _compile-time_ fiction
in TypeScript: `(restaurant as any).db` reaches it at runtime. (True-private `#db`
fields exist, but this project's `erasableSyntaxOnly` tsconfig bans
`constructor(private db: DB)` parameter properties — they emit runtime code — so
the class version is also more verbose here.)

### 3. Dependencies are visible as a plain type

`MakeRestaurantCfg` _is_ the contract: read it and you know exactly what the domain
needs. No scanning a constructor body, no decorators, no DI container. And because
the result is just an object satisfying `Restaurant` (structural typing), a test
double is a plain object literal — no `implements`, no subclass, no mock framework:

```ts
const stubRestaurant: Restaurant = { reserve: async () => "Accepted" /* … */ };
```

### 4. It's just a function

No `new`, so factories compose like any other function — partial application,
passing them around, returning them. `makeRestaurant({ db, logger })` is partial
application: fix the deps now, supply runtime args later (see
[the FP connection](#connection-to-functional-programming) below).

### Where classes actually win

This is a trade-off, not a slam dunk. Reach for a class when:

- **You create very many short-lived instances.** A class shares its methods on the
  prototype across all instances; each factory call allocates a fresh closure with
  fresh function objects. See [Memory and GC](#memory-and-gc-the-honest-cost-of-closures)
  below — it's a real cost in hot paths, irrelevant for startup-time singletons.
- **You need `instanceof`, real inheritance, or polymorphic hierarchies.**
- **The ecosystem expects classes** — NestJS, TypeORM entities, decorator-based DI.
- **Your team simply reasons better in classes.** Familiarity is a real cost too.

For the wiring layer in this project — a handful of services built once at
startup — none of those apply, so the factory's gains come essentially for free.

---

## Connection to functional programming

### Partial application

Calling `makeRestaurant({ db, restaurantCfg, logger, metrics })` is **partial
application**: you fix the dependency arguments now so the returned operations
only need the runtime arguments later.

Strict currying (`fn(a)(b)(c)`) is the mathematical version. Partial
application (fixing a group of arguments at once via a config object) is
the practical version. This project uses partial application.

### The Reader monad

In typed functional languages (Haskell, F#), the formal equivalent is the
**Reader monad**: a computation that depends on a shared environment. Your
factory is the same idea without the monad machinery.

`makeRestaurant({ db, cfg })` ≈ `Reader.ask(env => useEnv(env))` — the
environment is injected once, the computation sees it from then on.

If you later use `fp-ts` or `effect-ts`, the Reader pattern will feel
familiar because you have already been thinking in its terms.

### Mark Seemann on "dependency rejection"

Mark Seemann (author of _Dependency Injection Principles, Practices, and
Patterns_) argues that functional code does not need DI the way OOP code
does. In OOP, DI frameworks exist to work around the fact that objects
hide their dependencies. In FP, dependencies are explicit function
arguments — the type signature is the contract. Seemann calls this
**dependency rejection**: the function rejects the idea of hidden state
and requires every dependency to be passed explicitly.

This project is that idea applied to TypeScript.

---

## The object destructuring convention

**Inputs** always use a named config object:

```ts
// Good — names are visible at the call site
const restaurant = makeRestaurant({ db, restaurantCfg, logger, metrics });

// Bad — positional, caller must read the signature to know order
const restaurant = makeRestaurant(db, restaurantCfg, logger, metrics);
```

**Outputs** follow two rules depending on the function type:

`make*` functions return the port directly — the returned value IS the thing
the caller needs. When the port is a single operation, that is a function;
when the port is a multi-method interface, that is an object:

```ts
// Single-operation port — the function IS the port
const makeNoOpMetrics = (): Metrics => {
    return { increment: () => {}, timing: () => {} };
};
const metrics = makeNoOpMetrics();

// Multi-method port — the object IS the port (its methods are the verbs)
const makeRestaurant = (cfg: MakeRestaurantCfg): Restaurant => {
    return { reserve, cancel, update, getReservations };
};
const restaurant = makeRestaurant({ db, restaurantCfg, logger, metrics });
```

`compose*` functions return a **named bag** of the capabilities their entry point
drives — `{ listen }` for the server, `{ cli }` for the CLI:

```ts
// Composition roots — each returns the capability its entry point drives
const composeServerApp = (cfg) => {
    // ... wiring ...
    return { listen };
};

const composeCliApp = (cfg) => {
    // ... wiring ...
    return { cli };
};
```

Call sites destructure what they need:

```ts
const { listen } = composeServerApp({ restaurantCfg, logger, metrics, db, port });
const { cli } = composeCliApp({ restaurantCfg, logger, metrics, db });
```

The domain itself is built by `makeRestaurant` (a `make*`, returned directly),
which integration tests call to drive the domain without a transport:

```ts
const restaurant = makeRestaurant({ db, restaurantCfg, logger, metrics });
```

---

## Where the pattern lives in this project

```text
src/restaurant/domain/makeRestaurant.ts   ← the domain — one factory, four operations as methods
src/restaurant/ports/                     ← interfaces (what each factory depends on)
src/restaurant/adapters/                  ← concrete implementations (db, http, queue)
src/server/compose.ts                     ← composition root for the HTTP server
src/cli/compose.ts                        ← composition root for the CLI
```

Each `compose.ts` is a **composition root** — the only file for its entry
point that knows which concrete adapters are used. Everything else depends
on interfaces. This is
the Ports and Adapters (Hexagonal Architecture) pattern at the wiring layer.

---

## Known trade-offs

**Not a singleton by default.** Each call to `makeRestaurant(...)` creates a
new closure. If you need a single shared instance, call it once in
`compose.ts` and pass the result around — which is exactly what this project
does.

**No magic wiring.** Unlike NestJS or InversifyJS, there is no container
scanning for decorators. You wire manually in `compose.ts`. This is more
verbose in a large codebase but completely transparent — you can always read
the composition root and trace every dependency.

**Closure memory.** Each factory call allocates a new closure and a fresh set of
method functions. For service-level objects created once at startup this is
irrelevant; in hot paths it is not. This is the one place classes have a genuine
performance edge — see [Memory and GC](#memory-and-gc-the-honest-cost-of-closures).

---

## Memory and GC: the honest cost of closures

This is worth understanding precisely rather than worrying about vaguely, because
the answer is "it almost never matters here, and when it does there's a simple fix."

### Why a closure costs more than a class instance

A **class** defines its methods **once**, on the prototype. A thousand instances
share the same `reserve` function object; each instance is just a small record of
fields plus a pointer to the shared prototype.

A **factory** defines its methods **inside the call**, so they close over that
call's variables. Every call to `makeRestaurant(...)` creates:

1. a new closure scope holding `db`, `logger`, `metrics`, `restaurantCfg`, and
2. **brand-new function objects** for `reserve`, `cancel`, `update`,
   `getReservations` — one fresh set per call.

```ts
const a = makeRestaurant(deps);
const b = makeRestaurant(deps);
a.reserve === b.reserve; // false — two distinct function objects

class C {
    reserve() {}
}
new C().reserve === new C().reserve; // true — shared on the prototype
```

So N factory instances allocate N × (closure + 4 functions); N class instances
allocate N small objects sharing 4 prototype methods. More allocation up front,
and more for the garbage collector to reclaim when those instances die.

### Why it doesn't matter in this project

Every factory here is called **once, at startup**, in a `compose.ts`. One
`Restaurant`, one `DB`, one `Router` — they live for the whole process. The "per
instance" cost is paid a handful of times, total. The closures also _are_ the
encapsulation you want, so the allocation is buying something. **For long-lived
singletons, the factory pattern has no meaningful memory downside.**

The cost only becomes real when you call a factory **on a hot path** — e.g. once
per request, or in a tight loop, creating millions of short-lived instances. Then
the per-call allocation of four fresh function objects shows up as GC pressure.

### How to optimize a `make*` when it _is_ on a hot path

In order of preference:

**1. Don't put a factory on the hot path — hoist it.** This is almost always the
real fix. Build the object once outside the loop/handler and reuse it. It's what
`compose.ts` already does: `makeRestaurant` runs at startup, and every request
reuses the same `restaurant`.

```ts
// ✗ rebuilds the closure + 4 functions on every request
app.post("/reservations", async (req, res) => {
    const restaurant = makeRestaurant(deps);
    res.json(await restaurant.reserve(req.body));
});

// ✓ build once, reuse — zero per-request factory allocation
const restaurant = makeRestaurant(deps);
app.post("/reservations", async (req, res) => {
    res.json(await restaurant.reserve(req.body));
});
```

**2. If you truly need a new instance per call, drop the closure — use a plain
function that takes deps as arguments.** No closure is captured, no per-instance
method objects are created; the function is defined once and you pass state in:

```ts
// One function object for the whole process; "instance" state passed explicitly.
const reserve = (deps: ReserveDeps, input: ReservationInput) => {
    /* ... */
};

// hot path: no allocation beyond the arguments
await reserve(deps, input);
```

This is the top row of the [spectrum below](#when-to-choose-something-else) —
"plain functions, deps as params." You trade the tidy `restaurant.reserve(x)`
call site for `reserve(deps, x)`, but allocate nothing per call.

**3. If you need many instances _and_ shared methods _and_ `instanceof` — use a
class.** This is precisely the case classes are built for: methods on the
prototype, minimal per-instance footprint. Don't force the factory pattern where a
class is the right tool.

### Don't micro-optimize on faith — measure

Modern V8 is extremely good at closures: it optimizes hot closures, and short-lived
objects die in the cheap young generation of the GC. For the overwhelming majority
of code — anything not in a measured hot loop — the factory's allocation is noise.
Reach for options 2 or 3 only when a profiler points at factory allocation as a
real cost, not preemptively.

### Is this production-safe?

For **this** codebase: yes, and the factory closures are not the thing to watch.

Every `make*` here is called **once, at startup**, in `compose.ts` / `index.ts` —
one `Restaurant`, one `DB`, one `Router`, built when the server boots and reused
for the whole process. Per request, Express invokes the already-built handlers,
which call the already-built `restaurant.reserve` (the same function object every
time). **No factory runs per request; no closure is recreated.** The per-instance
allocation is paid ~once per service, ever — kilobytes at boot, below noise. A
class-based version would save those kilobytes once and change nothing at request
time, because the only per-request allocations (the parsed body, the log payload)
are identical in both styles.

The one thing that would move closure allocation onto the hot path is calling a
`make*` **inside** a request handler or loop (option 1 above) — which this code
does not do, and the [factory audit](#this-rule-is-enforced-not-just-documented)
plus the composition-root structure steer you away from.

So the honest production checklist puts closures last. The real scaling watch-items
in this code live elsewhere:

- **`makeDynamoDb.getReservations` uses `ScanCommand`** — a full-table scan whose
  cost and latency grow with the table. This is the genuine production concern;
  replace it with a query/pagination strategy before the table gets large.
- **`makeInMemoryDb` is not a production store** — it's process memory: single
  instance, lost on restart. The DynamoDB adapter is the production path.

---

## When to choose something else

This pattern — factory functions plus a hand-written composition root — is the
right default for small-to-medium apps that value clarity and zero magic. But it
is one point on a spectrum, and it has real costs: manual wiring grows linearly
with the app, and the make/compose split is a _convention_ you must keep honest
(which is why this repo ships an [audit](#this-rule-is-enforced-not-just-documented)).
Here is the spectrum, simplest → heaviest:

| Approach                                                     | vs. this repo                                                      | Choose it when                                                                                                |
| ------------------------------------------------------------ | ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------- |
| **Plain functions, deps as params** — `reserve(deps, input)` | drops the factory/closure layer entirely                           | the app is tiny or the logic is mostly pure; you want the least machinery                                     |
| **Factory functions + manual compose** _(this repo)_         | —                                                                  | small-to-medium apps; clarity and traceability matter most                                                    |
| **One typed `deps` bag threaded through**                    | a single `AppDeps` object instead of per-factory configs           | wiring churn hurts — but you accept weaker "visible dependencies at the boundary"                             |
| **Effect-TS `Layer`s (or fp-ts `Reader`)**                   | a _compiler-checked_ composition root, plus typed errors/resources | you want the type system to prove the graph is wired                                                          |
| **DI container (NestJS, tsyringe)**                          | decorators auto-wire at runtime                                    | a large team/app where manual wiring is genuinely too much, and you accept reflection + runtime wiring errors |

The honest weakness of _this_ pattern: the make/compose boundary is enforced by
discipline, not the compiler. A wiring mistake — a domain function that quietly
constructs its own database — is just code that runs. The `npm run audit` script
narrows that gap for the _naming_ rule, but it cannot prove the _graph_ is
correct. The next patterns up the ladder move that guarantee into the type system.

## How Effect-TS would do this

Effect-TS is essentially "this pattern, leveled up" — the same ports / adapters /
composition-root ideas, but the **compiler tracks the dependency graph for you**.
The mapping is almost one-to-one:

| This repo                         | Effect-TS                                                  |
| --------------------------------- | ---------------------------------------------------------- |
| a port (`DB`, `Logger` interface) | a `Context.Tag` — a typed key identifying a service        |
| a `make*` adapter                 | a value provided through a `Layer`                         |
| a `compose*` / composition root   | `Layer` composition (`Layer.provide` / `Layer.merge`)      |
| the domain op (`reserve`)         | an `Effect<A, E, R>` — `R` is the set of services it needs |
| `index.ts` running the app        | `Effect.runPromise(program.pipe(Effect.provide(AppLive)))` |

A sketch of our `reserve` in Effect:

```ts
import { Context, Effect, Layer } from "effect";

// A port becomes a Tag — a typed token for a service.
class Db extends Context.Tag("Db")<
    Db,
    {
        saveReservation: (input: ReservationInput) => Effect.Effect<Reservation>;
    }
>() {}

// The domain reads services from context instead of taking a config object.
// Its type carries the dependency: Effect<Reservation, never, Db>.
const reserve = (input: ReservationInput) =>
    Effect.gen(function* () {
        const db = yield* Db; // ← dependency, tracked in the type
        return yield* db.saveReservation(input);
    });

// An adapter is provided as a Layer (this fuses make* with the wiring step).
const DbLive = Layer.succeed(Db, {
    saveReservation: (input) => Effect.succeed({ id: "r1", ...input }),
});

// The composition root is just Layer composition.
const AppLive = DbLive; // .pipe(Layer.provideMerge(LoggerLive)), etc.

// Running provides the layers. Forget one and it does NOT compile.
Effect.runPromise(reserve(input).pipe(Effect.provide(AppLive)));
```

What you gain over the manual approach:

- **The dependency graph is type-checked.** `reserve`'s type is
  `Effect<…, …, Db>`; that `Db` in the third slot is an _unmet_ dependency, and
  `Effect.provide` discharges it. Forget to provide a service and it won't
  compile — exactly the guarantee our `audit` script can only _approximate_.
- **Resources and lifetimes are built in.** `Layer` handles acquire/release
  (connections, files) and memoizes services (singletons) — no "singleton by
  convention".
- **Typed errors and concurrency.** The `E` channel puts failures in the type,
  and Effect has first-class structured concurrency and interruption.

The cost is real: a steep learning curve, and the _whole_ app adopts the `Effect`
type. For a learning repo it's a "later" tool — but when manual wiring starts to
ache, `Layer` is the principled next step, **not** a decorator-based container.

---

## Summary in one line

```text
make*(deps) closes over dependencies → returns { op } → op(args) runs at request time
```

This is partial application plus the Revealing Module Pattern plus Ports and
Adapters wiring — with no framework, no decorators, and no `this`.

---

## Further reading

**Factory functions and the Module Pattern**

- [From the Module Pattern to Factory Functions](https://medium.com/programming-essentials/from-the-module-pattern-to-factory-functions-a741cfbe818e) — Cristian Salcescu. Traces the evolution from IIFE → Revealing Module → reusable factory.
- [Factory Functions and the Module Pattern](https://www.theodinproject.com/lessons/node-path-javascript-factory-functions-and-the-module-pattern) — The Odin Project. Practical walkthrough with closure examples.
- [Factory functions](https://medium.com/@_ericelliott/factory-functions-b50d041bb023) — Eric Elliott. The primary advocate for replacing classes with factory functions in JavaScript.

**Functional Dependency Injection**

- [Functional Dependency Injection in TypeScript](https://hassannteifeh.medium.com/functional-dependency-injection-in-typescript-4c2739326f57) — Hassan Nteifeh. Walks through the exact pattern this project uses.
- [TypeScript FP Dependency Injection Is Easy!](https://dev.to/tareksalem/typescript-fp-dependency-injection-is-easy-18pn) — DEV Community.
- [Dependency Injection in TypeScript](https://mateuszsuchon.com/articles/dependency-injection-in-typescript) — Mateusz Suchoń. Contrasts functional and OOP approaches.
- [7 Ways to do Dependency Injection in Functional JavaScript](https://happy-css.com/articles/dependency-injection-in-java-script/) — Comprehensive comparison of DI styles in JS.
- [Dependency Injection, Currying and Partial Application](https://medium.com/@curtistatewilkinson/dependency-injection-currying-and-partial-application-for-easy-unit-tests-ded40c39016c) — Curtis Tate Wilkinson.

**The Reader Monad connection**

- [Dependency Injection and Reader Monad](https://dev.to/napicella/dependency-injection-and-reader-monad-5ap4) — DEV Community. Shows how factory functions are a practical Reader monad.
- [Purely functional dependency injection in TypeScript](https://anttih.com/articles/2018/07/05/purely-functional-di) — Antti Holvikari. Deep dive into the FP underpinnings.

**Mark Seemann — Dependency Rejection**

- [From Dependency Injection to Dependency Rejection](https://www.youtube.com/watch?v=cxs7oLGrxQ4) — Talk arguing that FP makes explicit DI containers unnecessary.

**Ports and Adapters (Hexagonal Architecture)**

- [Hexagonal Architecture](https://jmgarridopaz.github.io/content/hexagonalarchitecture.html) — Juan Manuel Garrido de Paz. The original pattern this wiring style implements.
- [Ports and Adapters Architecture](https://medium.com/the-software-architecture-chronicles/ports-adapters-architecture-d19f2d476eca) — Herberto Graça.
