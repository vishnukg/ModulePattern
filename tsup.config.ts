import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    server: "src/server.ts",
    cli:    "src/cli.ts",
  },
  format:    ["esm"],
  sourcemap: true,   // generates .map files so stack traces show original TS lines
  clean:     true,   // wipe dist/ before each build
});
