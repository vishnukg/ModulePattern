export * from "./reservation/index.ts";
export { default as makeRestaurant } from "./makeRestaurant.ts";
export { default as composeRestaurant } from "./composeRestaurant.ts";
export type {
    Reservation,
    ReservationInput,
    RestaurantCfg,
    Restaurant,
    ReserveFn,
    CancelFn,
    UpdateFn,
    GetReservationsFn,
} from "./types.ts";
