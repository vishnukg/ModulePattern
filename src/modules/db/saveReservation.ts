import type { Reservation } from "../restaurant/types.ts";
import type { DBCfg } from "./types.ts";

export default ({ logger }: DBCfg) => {
  const reservations: Reservation[] = [];

  return (reservation: Reservation) => {
    logger.info("saving reservation", { quantity: reservation.quantity, date: reservation.date });
    reservations.push(reservation);
    return reservations;
  };
};
