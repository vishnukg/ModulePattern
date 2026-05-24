import { makeReserve }                              from "../core/index.ts";
import type { RestaurantCfg, DB, Logger, Metrics } from "../core/index.ts";

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
