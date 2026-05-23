import { parseArgs }            from "node:util";
import { randomUUID }           from "node:crypto";
import makeCliApp               from "./compose.ts";
import { makeConsoleLogger }    from "../modules/logger/index.ts";
import { makeNoOpMetrics }      from "../modules/metrics/index.ts";
import { makeInMemoryDb }       from "../modules/db/index.ts";

const { values } = parseArgs({
  options: {
    quantity: { type: "string", short: "q" },
    date:     { type: "string", short: "d" },
    seats:    { type: "string", short: "s" },
  },
});

const quantity = Number(values.quantity);
const date     = values.date ?? new Date().toLocaleDateString();
const seats    = Number(values.seats ?? 10);

if (!values.quantity || isNaN(quantity)) {
  console.error("Usage: cli --quantity <n> [--date <date>] [--seats <n>]");
  process.exit(1);
}

const logger  = makeConsoleLogger();
const metrics = makeNoOpMetrics();
const db      = makeInMemoryDb({ logger, generateId: randomUUID });

const { reserve } = makeCliApp({ restaurantCfg: { tableSize: seats }, logger, metrics, db });
const result = await reserve({ quantity, date });

console.log(`Reservation ${result} — ${quantity} seat(s) on ${date} (table size: ${seats})`);
