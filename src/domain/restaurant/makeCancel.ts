import type { DB }              from "./types.ts";
import type { Logger, Metrics } from "../../ports/index.ts";

type CancelCfg = { db: DB; logger: Logger; metrics: Metrics; };

const makeCancel = ({ db, logger, metrics }: CancelCfg) => {
  const cancel = async (id: string): Promise<"Cancelled" | "NotFound"> => {
    const start = Date.now();
    logger.info("cancellation attempt", { id });

    const found = await db.cancelReservation(id);
    metrics.timing("reservation.cancel_ms", Date.now() - start);

    if (!found) {
      logger.warn("cancellation not found", { id });
      return "NotFound";
    }

    metrics.increment("reservation.cancelled");
    logger.info("reservation cancelled", { id });
    return "Cancelled";
  };

  return cancel;
};

export default makeCancel;
