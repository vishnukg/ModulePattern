import { DynamoDBClient }                                         from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand, ScanCommand }        from "@aws-sdk/lib-dynamodb";
import { randomUUID }                                             from "node:crypto";
import type { DB, Reservation }                                   from "../restaurant/types.ts";
import type { DynamoDbCfg }                                       from "./types.ts";

const makeDynamoDb = ({ tableName, region, endpoint, logger }: DynamoDbCfg): DB => {
  const raw    = new DynamoDBClient({ region, ...(endpoint ? { endpoint } : {}) });
  const client = DynamoDBDocumentClient.from(raw);

  const saveReservation = async (reservation: Reservation): Promise<void> => {
    logger.info("saving reservation to DynamoDB", { quantity: reservation.quantity, date: reservation.date });
    await client.send(new PutCommand({
      TableName: tableName,
      Item:      { id: randomUUID(), ...reservation },
    }));
  };

  const getReservations = async (): Promise<Reservation[]> => {
    logger.info("fetching reservations from DynamoDB");
    const result = await client.send(new ScanCommand({ TableName: tableName }));
    return (result.Items ?? []).map(item => ({
      quantity: item.quantity as number,
      date:     item.date     as string,
    }));
  };

  return { saveReservation, getReservations };
};

export default makeDynamoDb;
