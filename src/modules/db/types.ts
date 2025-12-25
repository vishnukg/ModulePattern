import type { Reservation } from "../types.ts";

export type DB = {
  saveReservation: (reservation: Reservation) => Reservation[];
};
