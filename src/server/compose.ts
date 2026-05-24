import { makeReserve, makeCancel, makeUpdate, makeRestaurant } from "../domain/restaurant/index.ts";
import type { RestaurantCfg, DB }                              from "../domain/restaurant/index.ts";
import type { Logger, Metrics }                                from "../ports/index.ts";

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
