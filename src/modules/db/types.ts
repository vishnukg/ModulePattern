import type { Reservation } from "../restaurant/types.ts";

export type DB = {
  saveReservation: (reservation: Reservation) => Reservation[];
};
