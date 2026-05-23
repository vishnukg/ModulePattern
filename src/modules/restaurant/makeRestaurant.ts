import type { MakeRestaurantCfg } from "./types.ts";

const makeRestaurant = ({ reserve, getReservations }: MakeRestaurantCfg) => ({
  reserve,
  getReservations,
});

export default makeRestaurant;
