export * from "./reservation/index.ts";
export { default as makeRestaurant } from "./makeRestaurant.ts";
export type {
  Reservation,
  ReservationInput,
  RestaurantCfg,
  DB,
  Restaurant,
  ReserveFn,
  CancelFn,
  UpdateFn,
  GetReservationsFn,
} from "./types.ts";
