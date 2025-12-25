import type { Reservation } from "../restaurant/types.ts";

export default () => {
  // in memory db for now
  // maybe add more methods here later
  const reservations: Reservation[] = [];
  return (reservation: Reservation) => {
    reservations.push(reservation);
    return reservations;
  };
};
