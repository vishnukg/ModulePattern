import type { Reservation, ReservationInput } from "../domain/types.ts";

// Driven port — what the domain requires from a data store.
// makeInMemoryDb and makeDynamoDb (in adapters/db/) are the adapters that implement this.
export interface DB {
    saveReservation: (input: ReservationInput) => Promise<Reservation>;
    getReservations: () => Promise<Reservation[]>;
    cancelReservation: (id: string) => Promise<boolean>;
    updateReservation: (id: string, input: ReservationInput) => Promise<Reservation | null>;
}
