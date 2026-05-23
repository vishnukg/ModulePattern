import type { MakeRestaurantCfg } from "./types.ts";

const makeRestaurant = ({ reserve, cancel, update, getReservations }: MakeRestaurantCfg) => ({
  reserve,
  cancel,
  update,
  getReservations,
});

export default makeRestaurant;
