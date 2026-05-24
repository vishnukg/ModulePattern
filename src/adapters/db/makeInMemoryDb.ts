import type { DB, Reservation, ReservationInput, Logger } from "../../core/index.ts";

type InMemoryDbCfg = { logger: Logger; generateId: () => string; };

const makeInMemoryDb = ({ logger, generateId }: InMemoryDbCfg): DB => {
  const store: Reservation[] = [];

  const saveReservation = async (input: ReservationInput): Promise<Reservation> => {
    const reservation: Reservation = { id: generateId(), ...input };
    logger.info("saving reservation", { id: reservation.id, quantity: input.quantity, date: input.date });
    store.push(reservation);
    return reservation;
  };

  const getReservations = async (): Promise<Reservation[]> => [...store];

  const cancelReservation = async (id: string): Promise<boolean> => {
    const index = store.findIndex(r => r.id === id);
    if (index === -1) return false;
    store.splice(index, 1);
    return true;
  };

  const updateReservation = async (id: string, input: ReservationInput): Promise<Reservation | null> => {
    const index = store.findIndex(r => r.id === id);
    if (index === -1) return null;
    const updated: Reservation = { id, ...input };
    store[index] = updated;
    return updated;
  };

  return { saveReservation, getReservations, cancelReservation, updateReservation };
};

export default makeInMemoryDb;
