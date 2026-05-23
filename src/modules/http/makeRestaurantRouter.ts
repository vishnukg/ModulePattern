import { Router } from "express";
import type { MakeRestaurantRouterCfg } from "./types.ts";

const makeRestaurantRouter = ({ restaurant }: MakeRestaurantRouterCfg) => {
  const router = Router();

  router.post("/reservations", async (req, res) => {
    const { quantity, date } = req.body as { quantity: unknown; date: unknown };

    if (typeof quantity !== "number" || typeof date !== "string") {
      res.status(400).json({ error: "quantity must be a number, date must be a string" });
      return;
    }

    const result = await restaurant.reserve({ quantity, date });
    res.status(result === "Accepted" ? 201 : 422).json({ result });
  });

  router.get("/reservations", async (_req, res) => {
    const reservations = await restaurant.getReservations();
    res.json({ reservations });
  });

  return router;
};

export default makeRestaurantRouter;
