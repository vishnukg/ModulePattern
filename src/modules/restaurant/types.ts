import type { DB } from "../db/types.ts";

export type Reservation = { quantity: number; date: string };
export type RestaurantCfg = { tableSize: number };
export type ReserveCfg = { db: DB; restaurantCfg: RestaurantCfg };
