import type { RestaurantCfg } from "./restaurant/types.ts";
import type { Logger } from "./logger/types.ts";
import type { Metrics } from "./metrics/types.ts";

export type ComposeCfg = {
  restaurantCfg: RestaurantCfg;
  logger?: Logger;
  metrics?: Metrics;
};
