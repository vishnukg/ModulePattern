import type { Logger }  from "../logger/types.ts";
import type { Metrics } from "../metrics/types.ts";

export type Reservation       = { quantity: number; date: string };
export type RestaurantCfg     = { tableSize: number };

// Port: what the restaurant domain requires from a data store.
// Implementations live in src/modules/db/ — they depend inward on this interface.
export type DB = {
  saveReservation: (reservation: Reservation) => Promise<void>;
  getReservations: () => Promise<Reservation[]>;
};

export type ReserveFn         = (reservation: Reservation) => Promise<"Accepted" | "Rejected">;
export type GetReservationsFn = () => Promise<Reservation[]>;

export type ReserveCfg = {
  db:            DB;
  restaurantCfg: RestaurantCfg;
  logger:        Logger;
  metrics:       Metrics;
};

export type MakeRestaurantCfg = {
  reserve:         ReserveFn;
  getReservations: GetReservationsFn;
};

export type Restaurant = {
  reserve:         ReserveFn;
  getReservations: GetReservationsFn;
};
