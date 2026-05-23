import { makeConsoleLogger }                                      from "./modules/logger/index.ts";
import { makeNoOpMetrics }                                        from "./modules/metrics/index.ts";
import { makeInMemoryDb }                                         from "./modules/db/index.ts";
import { makeReserve, makeCancel, makeUpdate, makeRestaurant }    from "./modules/restaurant/index.ts";
import type { RestaurantCfg, DB }                                 from "./modules/restaurant/index.ts";
import type { Logger }                                            from "./modules/logger/index.ts";
import type { Metrics }                                           from "./modules/metrics/index.ts";

type MakeAppCfg = {
  restaurantCfg: RestaurantCfg;
  logger?:       Logger;
  metrics?:      Metrics;
  db?:           DB;
};

// Dependency graph:
//
//   restaurant
//     ├─ reserve       ─┐
//     ├─ cancel          ├─ db, logger, metrics
//     ├─ update         ─┘  (update also needs restaurantCfg)
//     └─ getReservations ── db
//
const makeApp = ({
  restaurantCfg,
  logger  = makeConsoleLogger(),
  metrics = makeNoOpMetrics(),
  db      = makeInMemoryDb({ logger }),
}: MakeAppCfg) => {
  const reserve    = makeReserve({ db, logger, metrics, restaurantCfg });
  const cancel     = makeCancel({ db, logger, metrics });
  const update     = makeUpdate({ db, logger, metrics, restaurantCfg });
  const restaurant = makeRestaurant({ reserve, cancel, update, getReservations: db.getReservations });

  return { restaurant };
};

export default makeApp;
