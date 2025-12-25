import type { Reservation } from "../types.ts";
import type { ReserveCfg } from "./types.ts";

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
