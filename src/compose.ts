import modules from "./modules/index.ts";
import { container } from "./container.ts";
import type { ComposeCfg } from "./modules/types.ts";

export default ({ restaurantCfg, logger: loggerOverride, metrics: metricsOverride }: ComposeCfg) =>
  container()
    .add("logger",          () => loggerOverride  ?? modules.logger.consoleLogger())
    .add("metrics",         () => metricsOverride ?? modules.metrics.fakeMetrics())
    .add("saveReservation", ({ logger }) => modules.db.saveReservation({ logger }))
    .add("db",              ({ saveReservation }) => ({ saveReservation }))
    .add("reserve",         ({ db, logger, metrics }) => modules.restaurant.reserve({ db, logger, metrics, restaurantCfg }))
    .add("restaurant",      ({ reserve }) => ({ reserve }))
    .build();
