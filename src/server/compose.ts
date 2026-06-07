import { composeRestaurant } from "../restaurant/index.ts";
import makeRestaurantRouter from "../restaurant/adapters/http/makeRestaurantRouter.ts";
import makeRestaurantServer from "../restaurant/adapters/http/makeRestaurantServer.ts";
import type { RestaurantCfg, DB, Logger, Metrics } from "../restaurant/index.ts";

type ServerAppCfg = {
    restaurantCfg: RestaurantCfg;
    logger: Logger;
    metrics: Metrics;
    db: DB;
    port?: number;
};

const composeServerApp = ({ restaurantCfg, logger, metrics, db, port = 3000 }: ServerAppCfg) => {
    const restaurant = composeRestaurant({ db, logger, metrics, restaurantCfg });
    const router = makeRestaurantRouter({ restaurant });
    const app = makeRestaurantServer({ router });

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
    if (!Number.isInteger(p) || p < 1 || p > 65_535)
        throw new Error(`Invalid port: "${value}" — must be an integer between 1 and 65535`);
    return p;
};

export default composeServerApp;
