import { parseArgs } from "node:util";
import { randomUUID } from "node:crypto";
import composeCliApp from "./compose.ts";
import makeConsoleLogger from "../adapters/logger/consoleLogger.ts";
import makeNoOpMetrics from "../adapters/metrics/makeNoOpMetrics.ts";
import makeInMemoryDb from "../adapters/db/makeInMemoryDb.ts";

const { values } = parseArgs({
    options: {
        quantity: { type: "string", short: "q" },
        date: { type: "string", short: "d" },
        seats: { type: "string", short: "s" },
    },
});

const quantity = Number(values.quantity);
const date = values.date ?? new Date().toLocaleDateString();
const seats = Number(values.seats ?? 10);

if (!values.quantity || isNaN(quantity)) {
    console.error("Usage: cli --quantity <n> [--date <date>] [--seats <n>]");
    process.exit(1);
}

const logger = makeConsoleLogger();
const metrics = makeNoOpMetrics();
const db = makeInMemoryDb({ logger, generateId: randomUUID });

const { run } = composeCliApp({ restaurantCfg: { tableSize: seats }, logger, metrics, db });
const result = await run({ quantity, date });

console.log(`Reservation ${result} — ${quantity} seat(s) on ${date} (table size: ${seats})`);
