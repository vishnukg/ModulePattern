import type { ReservationInput, DB, RestaurantCfg } from "../types.ts";
import type { Logger, Metrics }                      from "../../../ports/index.ts";

type ReserveCfg = { db: DB; restaurantCfg: RestaurantCfg; logger: Logger; metrics: Metrics; };

const makeReserve = ({ db, restaurantCfg, logger, metrics }: ReserveCfg) => {
  const reserve = async ({ quantity, date }: ReservationInput): Promise<"Accepted" | "Rejected"> => {
    const start = Date.now();
    logger.info("reservation attempt", { quantity, date });

    if (quantity <= restaurantCfg.tableSize) {
      await db.saveReservation({ quantity, date });
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

  return reserve;
};

export default makeReserve;
