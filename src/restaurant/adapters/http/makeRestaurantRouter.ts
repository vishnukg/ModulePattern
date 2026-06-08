import express, { type Router } from "express";
import type { Restaurant } from "../../index.ts";

type MakeRestaurantRouterCfg = { restaurant: Restaurant };

const isValidQuantity = (v: unknown): v is number =>
    typeof v === "number" && Number.isInteger(v) && v > 0;

const isValidDate = (v: unknown): v is string => typeof v === "string" && v.trim() !== "";

const BODY_ERROR = "quantity must be a positive integer, date must be a non-empty string";

// Express 5 forwards a rejected promise from an async handler to the error
// middleware automatically, so an infrastructure error thrown by the domain
// becomes a 500 (see makeRestaurantServer) without any try/catch here.
const makeRestaurantRouter = ({ restaurant }: MakeRestaurantRouterCfg): Router => {
    const router = express.Router();

    router.post("/reservations", async (req, res) => {
        const { quantity, date } = req.body as { quantity: unknown; date: unknown };
        if (!isValidQuantity(quantity) || !isValidDate(date)) {
            res.status(400).json({ error: BODY_ERROR });
            return;
        }
        const result = await restaurant.reserve({ quantity, date });
        res.status(result === "Accepted" ? 201 : 422).json({ result });
    });

    router.get("/reservations", async (_req, res) => {
        const reservations = await restaurant.getReservations();
        res.json({ reservations });
    });

    router.delete("/reservations/:id", async (req, res) => {
        const result = await restaurant.cancel(req.params.id);
        res.status(result === "Cancelled" ? 200 : 404).json({ result });
    });

    router.put("/reservations/:id", async (req, res) => {
        const { quantity, date } = req.body as { quantity: unknown; date: unknown };
        if (!isValidQuantity(quantity) || !isValidDate(date)) {
            res.status(400).json({ error: BODY_ERROR });
            return;
        }
        const result = await restaurant.update(req.params.id, { quantity, date });
        const status = result === "Updated" ? 200 : result === "NotFound" ? 404 : 422;
        res.status(status).json({ result });
    });

    return router;
};

export default makeRestaurantRouter;
