import type { Router }     from "express";
import type { Restaurant } from "../restaurant/types.ts";

export type MakeRestaurantRouterCfg = { restaurant: Restaurant; router: Router };
