import express                                        from "express";
import { DynamoDBClient }                            from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient }                    from "@aws-sdk/lib-dynamodb";
import { randomUUID }                                from "node:crypto";
import makeServerApp                                 from "./compose.ts";
import { makeConsoleLogger, makeNoOpMetrics }         from "../modules/shared/index.ts";
import { makeInMemoryDb, makeDynamoDb }              from "../modules/db/index.ts";
import { makeRestaurantRouter }                      from "../modules/http/index.ts";
import type { DB }                                   from "../modules/restaurant/index.ts";

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
