import makeConsoleLogger                from "./modules/logger/consoleLogger.ts";
import makeNoOpMetrics                  from "./modules/metrics/makeNoOpMetrics.ts";
import makeInMemoryDb                   from "./modules/db/makeInMemoryDb.ts";
import makeReserve                      from "./modules/restaurant/reserve.ts";
import makeRestaurant                   from "./modules/restaurant/makeRestaurant.ts";
import type { RestaurantCfg, DB }       from "./modules/restaurant/types.ts";
import type { Logger }                  from "./modules/logger/types.ts";
import type { Metrics }                 from "./modules/metrics/types.ts";

type MakeAppCfg = {
  restaurantCfg: RestaurantCfg;
  logger?:       Logger;
  metrics?:      Metrics;
  db?:           DB;
};

// Dependency graph:
//
//   restaurant
//     └─ reserve          getReservations
//          ├─ db      ────────────────────── db
//          │    └─ saveReservation
//          ├─ logger
//          └─ metrics
//
const makeApp = ({
  restaurantCfg,
  logger  = makeConsoleLogger(),
  metrics = makeNoOpMetrics(),
  db      = makeInMemoryDb({ logger }),
}: MakeAppCfg) => {
  const reserve    = makeReserve({ db, logger, metrics, restaurantCfg });
  const restaurant = makeRestaurant({ reserve, getReservations: db.getReservations });

  return { restaurant };
};

export default makeApp;
