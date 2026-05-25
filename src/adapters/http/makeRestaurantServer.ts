import express from "express";
import type { Router } from "express";

type RestaurantServerCfg = {
    router: Router;
};

const makeRestaurantServer = ({ router }: RestaurantServerCfg) => {
    const app = express();
    app.use(express.json());
    app.use("/api", router);
    return app;
};

export default makeRestaurantServer;
