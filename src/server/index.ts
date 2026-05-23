import express                              from "express";
import makeServerApp                        from "./compose.ts";
import { makeConsoleLogger }               from "../modules/logger/index.ts";
import { makeNoOpMetrics }                 from "../modules/metrics/index.ts";
import { makeInMemoryDb, makeDynamoDb }    from "../modules/db/index.ts";
import { makeRestaurantRouter }            from "../modules/http/index.ts";

const port      = Number(process.env.PORT       ?? 3000);
const tableSize = Number(process.env.TABLE_SIZE  ?? 10);

const logger  = makeConsoleLogger();
const metrics = makeNoOpMetrics();

const db = process.env.DYNAMODB_TABLE
  ? makeDynamoDb({
      tableName: process.env.DYNAMODB_TABLE,
      region:    process.env.AWS_REGION   ?? "us-east-1",
      endpoint:  process.env.DYNAMODB_ENDPOINT,
      logger,
    })
  : makeInMemoryDb({ logger });

const { restaurant }   = makeServerApp({ restaurantCfg: { tableSize }, logger, metrics, db });
const restaurantRouter = makeRestaurantRouter({ restaurant });

const app = express();
app.use(express.json());
app.use("/api", restaurantRouter);

app.listen(port, () => {
  logger.info("server started", { port, tableSize, db: process.env.DYNAMODB_TABLE ?? "in-memory" });
});
