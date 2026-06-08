import type { CancelFn } from "../types.ts";
import type { DB, Logger, Metrics } from "../../ports/index.ts";

type CancelCfg = { db: DB; logger: Logger; metrics: Metrics };

const makeCancel = ({ db, logger, metrics }: CancelCfg): CancelFn => {
    const cancel = async (id: string): Promise<"Cancelled" | "NotFound"> => {
        const start = Date.now();
        logger.info("cancellation attempt", { id });

        let found: boolean;
        try {
            found = await db.cancelReservation(id);
        } catch (err) {
            metrics.increment("reservation.cancel.error");
            metrics.timing("reservation.cancel_ms", Date.now() - start);
            logger.error("db error cancelling reservation", {
                id,
                message: err instanceof Error ? err.message : String(err),
            });
            throw err;
        }

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
