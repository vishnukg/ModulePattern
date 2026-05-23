import { parseArgs } from "node:util";
import makeApp from "./compose.ts";

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

const { restaurant } = makeApp({ restaurantCfg: { tableSize: seats } });
const result = await restaurant.reserve({ quantity, date });

console.log(`Reservation ${result} — ${quantity} seat(s) on ${date} (table size: ${seats})`);
