import type { Router }     from "express";
import type { Restaurant } from "../restaurant/types.ts";

type MakeRestaurantRouterCfg = { restaurant: Restaurant; router: Router; };

const makeRestaurantRouter = ({ restaurant, router }: MakeRestaurantRouterCfg) => {
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

  router.delete("/reservations/:id", async (req, res) => {
    const result = await restaurant.cancel(req.params.id);
    res.status(result === "Cancelled" ? 200 : 404).json({ result });
  });

  router.put("/reservations/:id", async (req, res) => {
    const { quantity, date } = req.body as { quantity: unknown; date: unknown };
    if (typeof quantity !== "number" || typeof date !== "string") {
      res.status(400).json({ error: "quantity must be a number, date must be a string" });
      return;
    }
    const result = await restaurant.update(req.params.id, { quantity, date });
    const status  = result === "Updated" ? 200 : result === "NotFound" ? 404 : 422;
    res.status(status).json({ result });
  });

  return router;
};

export default makeRestaurantRouter;
