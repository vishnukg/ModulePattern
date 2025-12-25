import type { DB } from "../db/types.ts";
import type { restaurantConfig } from "../types.ts";

export default ({
    db,
    restaurantConfig,
  }: {
    db: DB;
    restaurantConfig: restaurantConfig;
  }) =>
  ({ quantity, date }: { quantity: number; date: string }) => {
    // buisness logic
    if (quantity <= restaurantConfig.tableSize) {
      db.saveReservation({ quantity, date });
      return "Accepted";
    } else {
      return "Rejected";
    }
  };
