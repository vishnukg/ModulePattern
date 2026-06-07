// ── Data types ────────────────────────────────────────────────────────────────

export type Reservation = { id: string; quantity: number; date: string };
export type ReservationInput = { quantity: number; date: string };
export type RestaurantCfg = { tableSize: number };

// ── Operation signatures ───────────────────────────────────────────────────────

export type ReserveFn = (input: ReservationInput) => Promise<"Accepted" | "Rejected">;
export type CancelFn = (id: string) => Promise<"Cancelled" | "NotFound">;
export type UpdateFn = (
    id: string,
    input: ReservationInput,
) => Promise<"Updated" | "Rejected" | "NotFound">;
export type GetReservationsFn = () => Promise<Reservation[]>;

// ── Driving port ────────────────────────────────────────────────────────────────

// What the outside world (HTTP router, CLI) calls into the domain — the shape that
// makeRestaurant produces. makeRestaurantRouter translates HTTP into calls on it.
// (Driven ports the domain depends on — DB, Logger, Metrics — live in ../ports/.)
export interface Restaurant {
    reserve: ReserveFn;
    cancel: CancelFn;
    update: UpdateFn;
    getReservations: GetReservationsFn;
}
