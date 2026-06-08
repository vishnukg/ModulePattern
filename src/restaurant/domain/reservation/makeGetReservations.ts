import type { GetReservationsFn } from "../types.ts";
import type { DB, Logger, Metrics } from "../../ports/index.ts";

type GetReservationsCfg = { db: DB; logger: Logger; metrics: Metrics };

// Listing reservations adds no domain logic today — it is exactly what the DB
// already does. We still wrap it in a factory (rather than wiring
// db.getReservations straight through) so every domain operation is built the
// same way, and so this stays the single place to add a filter, pagination, an
// audit log, or a metric later.
const makeGetReservations = ({ db, logger, metrics }: GetReservationsCfg): GetReservationsFn => {
    return async () => {
        try {
            return await db.getReservations();
        } catch (err) {
            metrics.increment("reservation.list.error");
            logger.error("db error fetching reservations", {
                message: err instanceof Error ? err.message : String(err),
            });
            throw err;
        }
    };
};

export default makeGetReservations;
