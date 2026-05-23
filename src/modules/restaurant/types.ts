import type { DB } from "../db/types.ts";
import type { Logger } from "../logger/types.ts";
import type { Metrics } from "../metrics/types.ts";

export type Reservation = { quantity: number; date: string };
export type RestaurantCfg = { tableSize: number };
export type ReserveCfg = {
  db: DB;
  restaurantCfg: RestaurantCfg;
  logger: Logger;
  metrics: Metrics;
};
