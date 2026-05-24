import { makeReserve, makeCancel, makeUpdate, makeRestaurant } from "../modules/restaurant/index.ts";
import type { RestaurantCfg, DB }                              from "../modules/restaurant/index.ts";
import type { Logger, Metrics }                                from "../modules/shared/index.ts";

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
