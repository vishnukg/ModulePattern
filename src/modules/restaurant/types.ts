import type { Logger }  from "../logger/types.ts";
import type { Metrics } from "../metrics/types.ts";

export type Reservation      = { id: string; quantity: number; date: string };
export type ReservationInput = { quantity: number; date: string };
export type RestaurantCfg    = { tableSize: number };

// Port: what the restaurant domain requires from a data store.
// Implementations live in src/modules/db/ — they depend inward on this interface.
export type DB = {
  saveReservation:   (input: ReservationInput) => Promise<Reservation>;
  getReservations:   () => Promise<Reservation[]>;
  cancelReservation: (id: string) => Promise<boolean>;
  updateReservation: (id: string, input: ReservationInput) => Promise<Reservation | null>;
};

export type ReserveFn         = (input: ReservationInput)                      => Promise<"Accepted" | "Rejected">;
export type CancelFn          = (id: string)                                   => Promise<"Cancelled" | "NotFound">;
export type UpdateFn          = (id: string, input: ReservationInput)          => Promise<"Updated" | "Rejected" | "NotFound">;
export type GetReservationsFn = ()                                             => Promise<Reservation[]>;

export type ReserveCfg = {
  db:            DB;
  restaurantCfg: RestaurantCfg;
  logger:        Logger;
  metrics:       Metrics;
};

export type CancelCfg = {
  db:      DB;
  logger:  Logger;
  metrics: Metrics;
};

export type UpdateCfg = {
  db:            DB;
  restaurantCfg: RestaurantCfg;
  logger:        Logger;
  metrics:       Metrics;
};

export type MakeRestaurantCfg = {
  reserve:         ReserveFn;
  cancel:          CancelFn;
  update:          UpdateFn;
  getReservations: GetReservationsFn;
};

export type Restaurant = {
  reserve:         ReserveFn;
  cancel:          CancelFn;
  update:          UpdateFn;
  getReservations: GetReservationsFn;
};
