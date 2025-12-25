import type { Reservation, ReserveCfg } from "../types.ts";

export default ({ db, restaurantCfg }: ReserveCfg) =>
  ({ quantity, date }: Reservation) => {
    // buisness logic
    if (quantity <= restaurantCfg.tableSize) {
      db.saveReservation({ quantity, date });
      return "Accepted";
    } else {
      return "Rejected";
    }
  };
