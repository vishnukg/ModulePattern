import { parseArgs } from "node:util";
import { randomUUID } from "node:crypto";
import composeCliApp from "./compose.ts";
import { errorMessage } from "../shared/errorMessage.ts";
import { isPositiveInt } from "../shared/isPositiveInt.ts";
import makeConsoleLogger from "../restaurant/adapters/logger/makeConsoleLogger.ts";
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

// A non-numeric --seats would otherwise become a NaN tableSize and silently
// reject every reservation, so it gets the same scrutiny as --quantity.
if (!values.quantity || !isPositiveInt(quantity) || !isPositiveInt(seats)) {
    console.error(
        "Usage: cli --quantity <n> [--date <date>] [--seats <n>] — n must be a positive integer",
    );
    process.exit(1);
}

const logger = makeConsoleLogger();
const metrics = makeNoOpMetrics();
const db = makeInMemoryDb({ logger, generateId: randomUUID });

const { cli } = composeCliApp({ restaurantCfg: { tableSize: seats }, logger, metrics, db });

try {
    const message = await cli.reserve({ quantity, date });
    console.log(message);
} catch (err) {
    logger.error("operation failed", { message: errorMessage(err) });
    process.exit(1);
}
