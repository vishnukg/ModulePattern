import type { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import type { Logger }                 from "../logger/types.ts";

export type InMemoryDbCfg = {
  logger:     Logger;
  generateId: () => string;
};

export type DynamoDbCfg = {
  tableName:  string;
  client:     DynamoDBDocumentClient;
  logger:     Logger;
  generateId: () => string;
};
