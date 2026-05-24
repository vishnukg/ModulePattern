import type { ReserveFn, CancelFn, UpdateFn, GetReservationsFn } from "./types.ts";

type MakeRestaurantCfg = {
    reserve: ReserveFn;
    cancel: CancelFn;
    update: UpdateFn;
    getReservations: GetReservationsFn;
};

const makeRestaurant = ({ reserve, cancel, update, getReservations }: MakeRestaurantCfg) => ({
    reserve,
    cancel,
    update,
    getReservations,
});

export default makeRestaurant;
