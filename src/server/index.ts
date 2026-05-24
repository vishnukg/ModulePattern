import express                                        from "express";
import { DynamoDBClient }                            from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient }                    from "@aws-sdk/lib-dynamodb";
import { randomUUID }                                from "node:crypto";
import makeServerApp                                 from "./compose.ts";
import makeConsoleLogger                             from "../adapters/logger/consoleLogger.ts";
import makeNoOpMetrics                               from "../adapters/metrics/makeNoOpMetrics.ts";
import makeInMemoryDb                                from "../adapters/db/makeInMemoryDb.ts";
import makeDynamoDb                                  from "../adapters/db/makeDynamoDb.ts";
import makeRestaurantRouter                          from "../adapters/http/makeRestaurantRouter.ts";
import type { DB }                                   from "../domain/restaurant/index.ts";

const port      = Number(process.env.PORT       ?? 3000);
const tableSize = Number(process.env.TABLE_SIZE  ?? 10);

const logger  = makeConsoleLogger();
const metrics = makeNoOpMetrics();

const db: DB = (() => {
  if (!process.env.DYNAMODB_TABLE) return makeInMemoryDb({ logger, generateId: randomUUID });
  const region   = process.env.AWS_REGION        ?? "us-east-1";
  const endpoint = process.env.DYNAMODB_ENDPOINT;
  const raw      = new DynamoDBClient({ region, ...(endpoint ? { endpoint } : {}) });
  const client   = DynamoDBDocumentClient.from(raw);
  return makeDynamoDb({ tableName: process.env.DYNAMODB_TABLE, client, logger, generateId: randomUUID });
})();

const { restaurant }   = makeServerApp({ restaurantCfg: { tableSize }, logger, metrics, db });
const restaurantRouter = makeRestaurantRouter({ restaurant, router: express.Router() });

const app = express();
app.use(express.json());
app.use("/api", restaurantRouter);

app.listen(port, () => {
  logger.info("server started", { port, tableSize, db: process.env.DYNAMODB_TABLE ?? "in-memory" });
});
