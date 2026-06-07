import type { ReservationInput, RestaurantCfg, UpdateFn } from "../types.ts";
import type { DB, Logger, Metrics } from "../../ports/index.ts";

type UpdateCfg = {
    db: DB;
    restaurantCfg: RestaurantCfg;
    logger: Logger;
    metrics: Metrics;
};

const makeUpdate = ({ db, restaurantCfg, logger, metrics }: UpdateCfg): UpdateFn => {
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

        const updated = await db.updateReservation(id, input);
        metrics.timing("reservation.update_ms", Date.now() - start);

        if (updated === null) {
            logger.warn("update not found", { id });
            return "NotFound";
        }

        metrics.increment("reservation.update.accepted");
        logger.info("reservation updated", { id, ...input });
        return "Updated";
    };

    return update;
};

export default makeUpdate;
