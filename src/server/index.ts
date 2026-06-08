import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { randomUUID } from "node:crypto";
import composeServerApp, { readPort } from "./compose.ts";
import makeConsoleLogger from "../restaurant/adapters/logger/consoleLogger.ts";
import makeNoOpMetrics from "../restaurant/adapters/metrics/makeNoOpMetrics.ts";
import makeInMemoryDb from "../restaurant/adapters/db/makeInMemoryDb.ts";
import makeDynamoDb from "../restaurant/adapters/db/makeDynamoDb.ts";
import type { DB } from "../restaurant/index.ts";

const port = readPort(process.env.PORT, 3000);
const tableSize = Number(process.env.TABLE_SIZE ?? 10);

const logger = makeConsoleLogger();
const metrics = makeNoOpMetrics();

// Safety net for any promise rejection or thrown error that escapes all
// other boundaries. Log it, then exit so the process manager can restart cleanly.
process.on("unhandledRejection", (reason) => {
    logger.error("unhandled rejection", {
        message: reason instanceof Error ? reason.message : String(reason),
    });
    process.exit(1);
});

process.on("uncaughtException", (err) => {
    logger.error("uncaught exception", { message: err.message });
    process.exit(1);
});

const db: DB = (() => {
    if (!process.env.DYNAMODB_TABLE) return makeInMemoryDb({ logger, generateId: randomUUID });
    const region = process.env.AWS_REGION ?? "us-east-1";
    const endpoint = process.env.DYNAMODB_ENDPOINT;
    const raw = new DynamoDBClient({
        region,
        ...(endpoint ? { endpoint } : {}),
    });
    const client = DynamoDBDocumentClient.from(raw);
    return makeDynamoDb({
        tableName: process.env.DYNAMODB_TABLE,
        client,
        logger,
        generateId: randomUUID,
    });
})();

const { listen } = composeServerApp({ restaurantCfg: { tableSize }, logger, metrics, db, port });
listen((p) => {
    logger.info("server started", {
        port: p,
        tableSize,
        db: process.env.DYNAMODB_TABLE ?? "in-memory",
    });
});
