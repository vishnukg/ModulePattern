import { makeReserve }                from "../modules/restaurant/index.ts";
import type { RestaurantCfg, DB }    from "../modules/restaurant/index.ts";
import type { Logger }               from "../modules/logger/index.ts";
import type { Metrics }              from "../modules/metrics/index.ts";

type CliAppCfg = {
  restaurantCfg: RestaurantCfg;
  logger:        Logger;
  metrics:       Metrics;
  db:            DB;
};

const makeCliApp = ({ restaurantCfg, logger, metrics, db }: CliAppCfg) => {
  const reserve = makeReserve({ db, logger, metrics, restaurantCfg });
  return { reserve };
};

export default makeCliApp;
