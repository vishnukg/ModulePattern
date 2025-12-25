import type { DB } from "../db/types.ts";
import type { restaurantCfg } from "../types.ts";

export default ({
    db,
    restaurantCfg,
  }: {
    db: DB;
    restaurantCfg: restaurantCfg;
  }) =>
  ({ quantity, date }: { quantity: number; date: string }) => {
    // buisness logic
    if (quantity <= restaurantCfg.tableSize) {
      db.saveReservation({ quantity, date });
      return "Accepted";
    } else {
      return "Rejected";
    }
  };
