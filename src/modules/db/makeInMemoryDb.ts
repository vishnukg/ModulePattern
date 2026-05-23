import type { DB, Reservation } from "../restaurant/types.ts";
import type { InMemoryDbCfg }   from "./types.ts";

const makeInMemoryDb = ({ logger }: InMemoryDbCfg): DB => {
  const reservations: Reservation[] = [];

  const saveReservation = async (reservation: Reservation): Promise<void> => {
    logger.info("saving reservation", { quantity: reservation.quantity, date: reservation.date });
    reservations.push(reservation);
  };

  const getReservations = async (): Promise<Reservation[]> => [...reservations];

  return { saveReservation, getReservations };
};

export default makeInMemoryDb;
