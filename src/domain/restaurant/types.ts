// ── Data types ────────────────────────────────────────────────────────────────

export type Reservation      = { id: string; quantity: number; date: string };
export type ReservationInput = { quantity: number; date: string };
export type RestaurantCfg    = { tableSize: number };

// ── Operation signatures ───────────────────────────────────────────────────────

export type ReserveFn         = (input: ReservationInput)                 => Promise<"Accepted" | "Rejected">;
export type CancelFn          = (id: string)                              => Promise<"Cancelled" | "NotFound">;
export type UpdateFn          = (id: string, input: ReservationInput)     => Promise<"Updated" | "Rejected" | "NotFound">;
export type GetReservationsFn = ()                                        => Promise<Reservation[]>;

// ── Ports (interfaces the domain defines; adapters in db/ and http/ satisfy them)

// Driven port — what the domain requires from a data store.
// makeInMemoryDb and makeDynamoDb are the adapters that implement this.
export interface DB {
  saveReservation:   (input: ReservationInput) => Promise<Reservation>;
  getReservations:   () => Promise<Reservation[]>;
  cancelReservation: (id: string) => Promise<boolean>;
  updateReservation: (id: string, input: ReservationInput) => Promise<Reservation | null>;
}

// Driving port — what the outside world (HTTP router, CLI) calls into the domain.
// makeRestaurantRouter is the adapter that translates HTTP into calls on this interface.
export interface Restaurant {
  reserve:         ReserveFn;
  cancel:          CancelFn;
  update:          UpdateFn;
  getReservations: GetReservationsFn;
}
