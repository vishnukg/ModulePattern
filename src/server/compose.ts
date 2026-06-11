import { makeRestaurant } from "../restaurant/index.ts";
import makeRestaurantRouter from "../restaurant/adapters/http/makeRestaurantRouter.ts";
import makeRestaurantServer from "../restaurant/adapters/http/makeRestaurantServer.ts";
import type { RestaurantCfg, DB, Logger, Metrics } from "../restaurant/index.ts";
import { isPositiveInt } from "../shared/isPositiveInt.ts";

type ServerAppCfg = {
    restaurantCfg: RestaurantCfg;
    logger: Logger;
    metrics: Metrics;
    db: DB;
    port?: number;
};

const composeServerApp = ({ restaurantCfg, logger, metrics, db, port = 3000 }: ServerAppCfg) => {
    const restaurant = makeRestaurant({ db, logger, metrics, restaurantCfg });
    const router = makeRestaurantRouter({ restaurant });
    const app = makeRestaurantServer({ router, logger });

    const listen = (onReady: (port: number) => void) => {
        const server = app.listen(port, () => onReady(port));
        server.on("error", (err: NodeJS.ErrnoException) => {
            logger.error("server failed to start", { message: err.message, code: err.code });
            process.exit(1);
        });
    };

    return { listen };
};

export const readPort = (value: string | undefined, fallback: number): number => {
    if (!value?.trim()) return fallback;
    const p = Number(value);
    if (!isPositiveInt(p) || p > 65_535)
        throw new Error(`Invalid port: "${value}" — must be an integer between 1 and 65535`);
    return p;
};

// Same treatment for other numeric env vars (e.g. TABLE_SIZE) — fail loudly at
// startup rather than letting Number("abc") become a NaN tableSize that
// silently rejects every reservation.
export const readPositiveInt = (
    name: string,
    value: string | undefined,
    fallback: number,
): number => {
    if (!value?.trim()) return fallback;
    const n = Number(value);
    if (!isPositiveInt(n))
        throw new Error(`Invalid ${name}: "${value}" — must be a positive integer`);
    return n;
};

export default composeServerApp;
