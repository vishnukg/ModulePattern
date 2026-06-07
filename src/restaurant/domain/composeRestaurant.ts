import makeReserve from "./reservation/reserve.ts";
import makeCancel from "./reservation/makeCancel.ts";
import makeUpdate from "./reservation/makeUpdate.ts";
import makeGetReservations from "./reservation/makeGetReservations.ts";
import makeRestaurant from "./makeRestaurant.ts";
import type { RestaurantCfg, Restaurant } from "./types.ts";
import type { DB, Logger, Metrics } from "../ports/index.ts";

type ComposeRestaurantCfg = {
    db: DB;
    logger: Logger;
    metrics: Metrics;
    restaurantCfg: RestaurantCfg;
};

// The single place the domain is assembled: build each operation from its driven
// ports (db, logger, metrics) and bundle them into the Restaurant port. Both entry
// points (cli/compose, server/compose) reuse this, so the wiring lives in one spot —
// they differ only in the driving adapter they wrap it with (CLI vs HTTP router).
const composeRestaurant = ({
    db,
    logger,
    metrics,
    restaurantCfg,
}: ComposeRestaurantCfg): Restaurant => {
    const reserve = makeReserve({ db, logger, metrics, restaurantCfg });
    const cancel = makeCancel({ db, logger, metrics });
    const update = makeUpdate({ db, logger, metrics, restaurantCfg });
    const getReservations = makeGetReservations({ db });
    return makeRestaurant({ reserve, cancel, update, getReservations });
};

export default composeRestaurant;
