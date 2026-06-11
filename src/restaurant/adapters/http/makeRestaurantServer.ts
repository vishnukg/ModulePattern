import express, {
    type Router,
    type Express,
    type Request,
    type Response,
    type NextFunction,
} from "express";
import type { Logger } from "../../index.ts";
import { errorMessage } from "../../../shared/errorMessage.ts";

type RestaurantServerCfg = {
    router: Router;
    logger: Logger;
};

const makeRestaurantServer = ({ router, logger }: RestaurantServerCfg): Express => {
    const app = express();
    app.use(express.json());
    app.use("/api", router);

    // Last-resort error boundary: catches anything that async route handlers
    // pass to next(err). Domain operations already log with operation context;
    // this adds the HTTP context (method, path) and always sends a safe 500
    // so no internal detail leaks to the client.
    app.use((err: unknown, req: Request, res: Response, _next: NextFunction) => {
        logger.error("request failed", {
            method: req.method,
            path: req.path,
            message: errorMessage(err),
        });
        res.status(500).json({ error: "Internal server error" });
    });

    return app;
};

export default makeRestaurantServer;
