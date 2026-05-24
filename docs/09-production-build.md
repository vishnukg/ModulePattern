# 09 — Running in Production

## The current approach: native Node.js

Since Node.js 22, you can run `.ts` files directly with no extra tools:

```bash
node src/server/index.ts
```

That is what this project does in both development and production.
The same command, the same runtime, the same behaviour everywhere.

```bash
npm run server   # node --watch src/server/index.ts  (dev — restarts on file changes)
npm start        # node src/server/index.ts          (prod — identical, minus the watch)
```

This works because Node.js strips type annotations at startup (~45ms, once,
then irrelevant for a long-running server). No build step, no compilation
artefact, no separate dev-vs-prod toolchain to maintain.

### Why this project qualifies

Not every TypeScript codebase can use native Node.js execution. It only works
for **erasable syntax** — types that can be stripped by replacing them with
whitespace, without any code transformation needed.

The constructs Node.js cannot handle:
- `enum` (generates runtime code)
- Namespace blocks with runtime values
- Parameter properties (`constructor(public x: string)`)
- Decorators

This project already has `"erasableSyntaxOnly": true` in `tsconfig.json`, which
makes the TypeScript compiler enforce this. If you accidentally add an enum,
`npm run typecheck` fails before the code ever runs.

---

## Type checking is a separate step

Node.js strips types — it does not check them. A type error will not
prevent the server from starting. That is why the project has an explicit
typecheck script:

```bash
npm run typecheck   # tsc --noEmit — checks types, emits nothing
```

Run this in CI before deploying. It is also a prerequisite for `npm run build`
(see below), but for the normal server workflow you need to run it explicitly.

**Recommended CI sequence:**

```bash
npm run typecheck
npm run lint
npm test
```

That is sufficient to safely deploy with `npm start`.

---

## Debugging

Stack traces point directly to your `.ts` source files — no source maps needed,
no translation step. This is one of the biggest practical advantages of native
execution: the error you see in production is the exact file and line number
you edit in your editor.

```
Error: something went wrong
    at reserve (src/core/domain/restaurant/reservation/reserve.ts:8:5)   ← exact source location
```

### VS Code debugging

No configuration needed. Set a breakpoint in any `.ts` file and run the server
with the built-in Node.js debugger:

```bash
node --inspect src/server/index.ts
```

Or add a launch configuration to `.vscode/launch.json`:

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "type": "node",
      "request": "launch",
      "name": "Debug server",
      "program": "${workspaceFolder}/src/server/index.ts",
      "runtimeArgs": ["--watch"]
    }
  ]
}
```

---

## The build step is optional

`npm run build` (tsup + esbuild) is kept in the project but is **not required**
for normal development or for deploying a server. It exists for specific
scenarios where you need a compiled artefact:

| Scenario | Use build? |
|---|---|
| Long-running server (Docker, EC2, Railway, Fly.io) | No — `npm start` is sufficient |
| AWS Lambda | Yes — bundle everything into a single file for cold-start performance |
| Distributing a CLI as an npm package | Yes — consumers should not need TypeScript installed |
| CI/CD pipeline health check | Optional — `npm run typecheck` covers type safety |

When you do need it:

```bash
npm run build   # runs typecheck first (prebuild hook), then tsup → dist/
```

Output lands in `dist/` with source maps included. The `dist/` directory is
gitignored — it is never committed.

### esbuild is the fastest bundler available

When you do run the build, it is fast. esbuild is written in Go and runs
outside the JavaScript VM, parallelising work across CPU cores:

```
ESM dist/server.js             2.36 KB
ESM dist/chunk-W73JBMPA.js     6.68 KB
ESM dist/cli.js                 851 B
⚡️ Build success in 10ms
```

`tsup` is a thin TypeScript-friendly wrapper around esbuild that reads
`tsconfig.json` and handles multiple entry points.

### Lambda deployment

If you deploy to Lambda, add `noExternal: [/.*/]` to `tsup.config.ts` to
bundle `node_modules` into the output. Everything else stays the same.

---

## npm scripts reference

| Script | Command | When to use |
|---|---|---|
| `npm run server` | `node --watch src/server/index.ts` | Daily development |
| `npm run server:dynamo` | same + DynamoDB env vars | Dev against LocalStack |
| `npm start` | `node src/server/index.ts` | Production server |
| `npm run start:dynamo` | same + DynamoDB env vars | Production with DynamoDB |
| `npm run cli` | `node src/cli/index.ts` | Run the CLI |
| `npm run typecheck` | `tsc --noEmit` | Before every deploy, in CI |
| `npm run build` | typecheck + tsup | Lambda / package distribution only |
| `npm test` | vitest | Always |
| `npm run lint` | eslint | Always |
