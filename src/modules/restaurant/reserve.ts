import type { Reservation, ReserveCfg } from "./types.ts";

export default ({ db, restaurantCfg, logger, metrics }: ReserveCfg) =>
  ({ quantity, date }: Reservation) => {
    const start = Date.now();
    logger.info("reservation attempt", { quantity, date });

    if (quantity <= restaurantCfg.tableSize) {
      db.saveReservation({ quantity, date });
      metrics.increment("reservation.accepted");
      metrics.timing("reservation.duration_ms", Date.now() - start);
      logger.info("reservation accepted", { quantity, date });
      return "Accepted";
    }

    metrics.increment("reservation.rejected");
    metrics.timing("reservation.duration_ms", Date.now() - start);
    logger.warn("reservation rejected", { quantity, date, tableSize: restaurantCfg.tableSize });
    return "Rejected";
  };
