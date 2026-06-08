import type { Reservation, ReservationInput, RestaurantCfg, Restaurant } from "./types.ts";
import type { DB, Logger, Metrics } from "../ports/index.ts";

type MakeRestaurantCfg = {
    db: DB;
    logger: Logger;
    metrics: Metrics;
    restaurantCfg: RestaurantCfg;
};

// The restaurant domain — one factory that closes over its driven ports
// (db, logger, metrics) and exposes the four operations as methods. This is the
// module pattern at its core: dependencies hidden in the closure, behaviour
// exposed as a noun (Restaurant) whose methods are verbs (reserve, cancel, …).
//
// Business failures are returned as typed values ("Rejected", "NotFound").
// Infrastructure failures (a thrown DB call) are logged with operation context,
// counted, and re-thrown for the transport layer to turn into a 500 / exit.
const makeRestaurant = ({ db, logger, metrics, restaurantCfg }: MakeRestaurantCfg): Restaurant => {
    const reserve = async ({
        quantity,
        date,
    }: ReservationInput): Promise<"Accepted" | "Rejected"> => {
        const start = Date.now();
        logger.info("reservation attempt", { quantity, date });

        if (quantity <= restaurantCfg.tableSize) {
            try {
                await db.saveReservation({ quantity, date });
            } catch (err) {
                metrics.increment("reservation.error");
                metrics.timing("reservation.duration_ms", Date.now() - start);
                logger.error("db error saving reservation", {
                    quantity,
                    date,
                    message: err instanceof Error ? err.message : String(err),
                });
                throw err;
            }
            metrics.increment("reservation.accepted");
            metrics.timing("reservation.duration_ms", Date.now() - start);
            logger.info("reservation accepted", { quantity, date });
            return "Accepted";
        }

        metrics.increment("reservation.rejected");
        metrics.timing("reservation.duration_ms", Date.now() - start);
        logger.warn("reservation rejected", {
            quantity,
            date,
            tableSize: restaurantCfg.tableSize,
        });
        return "Rejected";
    };

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

    const update = async (
        id: string,
        input: ReservationInput,
    ): Promise<"Updated" | "Rejected" | "NotFound"> => {
        const start = Date.now();
        logger.info("update attempt", { id, ...input });

        if (input.quantity > restaurantCfg.tableSize) {
            metrics.increment("reservation.update.rejected");
            metrics.timing("reservation.update_ms", Date.now() - start);
            logger.warn("update rejected — exceeds table size", {
                id,
                ...input,
                tableSize: restaurantCfg.tableSize,
            });
            return "Rejected";
        }

        let updated: Reservation | null;
        try {
            updated = await db.updateReservation(id, input);
        } catch (err) {
            metrics.increment("reservation.update.error");
            metrics.timing("reservation.update_ms", Date.now() - start);
            logger.error("db error updating reservation", {
                id,
                ...input,
                message: err instanceof Error ? err.message : String(err),
            });
            throw err;
        }

        metrics.timing("reservation.update_ms", Date.now() - start);

        if (updated === null) {
            logger.warn("update not found", { id });
            return "NotFound";
        }

        metrics.increment("reservation.update.accepted");
        logger.info("reservation updated", { id, ...input });
        return "Updated";
    };

    const getReservations = async (): Promise<Reservation[]> => {
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

    return { reserve, cancel, update, getReservations };
};

export default makeRestaurant;
