import express, { type Router, type Request, type Response, type NextFunction } from "express";
import type { Restaurant } from "../../index.ts";

type MakeRestaurantRouterCfg = { restaurant: Restaurant };

// Wraps an async route handler so any thrown error is forwarded to Express's
// error middleware instead of becoming an unhandled rejection.
const asyncHandler =
    (fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) =>
    (req: Request, res: Response, next: NextFunction): void => {
        fn(req, res, next).catch(next);
    };

const isValidQuantity = (v: unknown): v is number =>
    typeof v === "number" && Number.isInteger(v) && v > 0;

const isValidDate = (v: unknown): v is string => typeof v === "string" && v.trim() !== "";

const BODY_ERROR = "quantity must be a positive integer, date must be a non-empty string";

const makeRestaurantRouter = ({ restaurant }: MakeRestaurantRouterCfg): Router => {
    const router = express.Router();

    router.post(
        "/reservations",
        asyncHandler(async (req, res) => {
            const { quantity, date } = req.body as { quantity: unknown; date: unknown };
            if (!isValidQuantity(quantity) || !isValidDate(date)) {
                res.status(400).json({ error: BODY_ERROR });
                return;
            }
            const result = await restaurant.reserve({ quantity, date });
            res.status(result === "Accepted" ? 201 : 422).json({ result });
        }),
    );

    router.get(
        "/reservations",
        asyncHandler(async (_req, res) => {
            const reservations = await restaurant.getReservations();
            res.json({ reservations });
        }),
    );

    router.delete(
        "/reservations/:id",
        asyncHandler(async (req, res) => {
            const result = await restaurant.cancel(req.params.id);
            res.status(result === "Cancelled" ? 200 : 404).json({ result });
        }),
    );

    router.put(
        "/reservations/:id",
        asyncHandler(async (req, res) => {
            const { quantity, date } = req.body as { quantity: unknown; date: unknown };
            if (!isValidQuantity(quantity) || !isValidDate(date)) {
                res.status(400).json({ error: BODY_ERROR });
                return;
            }
            const result = await restaurant.update(req.params.id, { quantity, date });
            const status = result === "Updated" ? 200 : result === "NotFound" ? 404 : 422;
            res.status(status).json({ result });
        }),
    );

    return router;
};

export default makeRestaurantRouter;
