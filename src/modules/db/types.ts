import type { Reservation } from "../restaurant/types.ts";
import type { Logger } from "../logger/types.ts";

export type DBCfg = { logger: Logger };

export type DB = {
  saveReservation: (reservation: Reservation) => Reservation[];
};
