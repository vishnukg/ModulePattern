import { makeReserve }                from "../domain/restaurant/index.ts";
import type { RestaurantCfg, DB }    from "../domain/restaurant/index.ts";
import type { Logger, Metrics }      from "../ports/index.ts";

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
