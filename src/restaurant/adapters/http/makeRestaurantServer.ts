import express, { type Router, type Express } from "express";

type RestaurantServerCfg = {
    router: Router;
};

const makeRestaurantServer = ({ router }: RestaurantServerCfg): Express => {
    const app = express();
    app.use(express.json());
    app.use("/api", router);
    return app;
};

export default makeRestaurantServer;
