import { makeReserve, makeCancel, makeUpdate, makeRestaurant } from "../core/index.ts";
import type { RestaurantCfg, DB, Logger, Metrics }             from "../core/index.ts";

type ServerAppCfg = {
  restaurantCfg: RestaurantCfg;
  logger:        Logger;
  metrics:       Metrics;
  db:            DB;
};

const makeServerApp = ({ restaurantCfg, logger, metrics, db }: ServerAppCfg) => {
  const reserve    = makeReserve({ db, logger, metrics, restaurantCfg });
  const cancel     = makeCancel({ db, logger, metrics });
  const update     = makeUpdate({ db, logger, metrics, restaurantCfg });
  const restaurant = makeRestaurant({ reserve, cancel, update, getReservations: db.getReservations });

  return { restaurant };
};

export default makeServerApp;
