import express             from "express";
import makeApp             from "./compose.ts";
import makeConsoleLogger   from "./modules/logger/consoleLogger.ts";
import makeDynamoDb        from "./modules/db/makeDynamoDb.ts";
import makeRestaurantRouter from "./modules/http/makeRestaurantRouter.ts";

const port      = Number(process.env.PORT       ?? 3000);
const tableSize = Number(process.env.TABLE_SIZE  ?? 10);

const logger = makeConsoleLogger();

// Use DynamoDB when DYNAMODB_TABLE is set, otherwise fall back to in-memory.
// DYNAMODB_ENDPOINT points to LocalStack locally (http://localhost:4566).
const db = process.env.DYNAMODB_TABLE
  ? makeDynamoDb({
      tableName: process.env.DYNAMODB_TABLE,
      region:    process.env.AWS_REGION         ?? "us-east-1",
      endpoint:  process.env.DYNAMODB_ENDPOINT,
      logger,
    })
  : undefined;

const { restaurant }   = makeApp({ restaurantCfg: { tableSize }, logger, db });
const restaurantRouter = makeRestaurantRouter({ restaurant });

const app = express();
app.use(express.json());
app.use("/api", restaurantRouter);

app.listen(port, () => {
  logger.info("server started", { port, tableSize, db: process.env.DYNAMODB_TABLE ?? "in-memory" });
});
