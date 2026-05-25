import { makeReserve, makeCancel, makeUpdate, makeRestaurant } from "../core/index.ts";
import type { RestaurantCfg, DB, Logger, Metrics } from "../core/index.ts";

type CliAppCfg = {
    restaurantCfg: RestaurantCfg;
    logger: Logger;
    metrics: Metrics;
    db: DB;
};

const composeCliApp = ({ restaurantCfg, logger, metrics, db }: CliAppCfg) => {
    const reserve = makeReserve({ db, logger, metrics, restaurantCfg });
    const cancel = makeCancel({ db, logger, metrics });
    const update = makeUpdate({ db, logger, metrics, restaurantCfg });
    const restaurant = makeRestaurant({
        reserve,
        cancel,
        update,
        getReservations: db.getReservations,
    });

    return { run: restaurant.reserve };
};

export default composeCliApp;
