import type { DB } from "../db/types.ts";
import type { RestaurantCfg } from "../types.ts";

export type ReserveCfg = { db: DB; restaurantCfg: RestaurantCfg };
