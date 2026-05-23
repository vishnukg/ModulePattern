import type { Logger } from "../logger/types.ts";

export type InMemoryDbCfg = { logger: Logger };

export type DynamoDbCfg = {
  tableName: string;
  region:    string;
  endpoint?: string;
  logger:    Logger;
};
