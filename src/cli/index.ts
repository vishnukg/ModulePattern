import { parseArgs } from "node:util";
import { randomUUID } from "node:crypto";
import composeCliApp from "./compose.ts";
import makeConsoleLogger from "../restaurant/adapters/logger/consoleLogger.ts";
import makeNoOpMetrics from "../restaurant/adapters/metrics/makeNoOpMetrics.ts";
import makeInMemoryDb from "../restaurant/adapters/db/makeInMemoryDb.ts";

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

if (!values.quantity || Number.isNaN(quantity)) {
    console.error("Usage: cli --quantity <n> [--date <date>] [--seats <n>]");
    process.exit(1);
}

const logger = makeConsoleLogger();
const metrics = makeNoOpMetrics();
const db = makeInMemoryDb({ logger, generateId: randomUUID });

const { cli } = composeCliApp({ restaurantCfg: { tableSize: seats }, logger, metrics, db });

try {
    const message = await cli.reserve({ quantity, date }, seats);
    console.log(message);
} catch (err) {
    logger.error("operation failed", {
        message: err instanceof Error ? err.message : String(err),
    });
    process.exit(1);
}
