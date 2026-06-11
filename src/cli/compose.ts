import { makeRestaurant } from "../restaurant/index.ts";
import makeRestaurantCli from "../restaurant/adapters/cli/makeRestaurantCli.ts";
import type { RestaurantCfg, DB, Logger, Metrics } from "../restaurant/index.ts";

type CliAppCfg = {
    restaurantCfg: RestaurantCfg;
    logger: Logger;
    metrics: Metrics;
    db: DB;
};

const composeCliApp = ({ restaurantCfg, logger, metrics, db }: CliAppCfg) => {
    const restaurant = makeRestaurant({ db, logger, metrics, restaurantCfg });
    const cli = makeRestaurantCli({ restaurant, tableSize: restaurantCfg.tableSize });

    return { cli };
};

export default composeCliApp;
