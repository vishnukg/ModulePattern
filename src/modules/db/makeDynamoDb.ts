import { DynamoDBClient }                                                    from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand, ScanCommand, GetCommand, DeleteCommand } from "@aws-sdk/lib-dynamodb";
import { randomUUID }                                                         from "node:crypto";
import type { DB, Reservation, ReservationInput }                             from "../restaurant/types.ts";
import type { DynamoDbCfg }                                                   from "./types.ts";

const makeDynamoDb = ({ tableName, region, endpoint, logger }: DynamoDbCfg): DB => {
  const raw    = new DynamoDBClient({ region, ...(endpoint ? { endpoint } : {}) });
  const client = DynamoDBDocumentClient.from(raw);

  const saveReservation = async (input: ReservationInput): Promise<Reservation> => {
    const reservation: Reservation = { id: randomUUID(), ...input };
    logger.info("saving reservation to DynamoDB", { id: reservation.id, ...input });
    await client.send(new PutCommand({ TableName: tableName, Item: reservation }));
    return reservation;
  };

  const getReservations = async (): Promise<Reservation[]> => {
    logger.info("fetching reservations from DynamoDB");
    const result = await client.send(new ScanCommand({ TableName: tableName }));
    return (result.Items ?? []).map(item => ({
      id:       item.id       as string,
      quantity: item.quantity as number,
      date:     item.date     as string,
    }));
  };

  const cancelReservation = async (id: string): Promise<boolean> => {
    const existing = await client.send(new GetCommand({ TableName: tableName, Key: { id } }));
    if (!existing.Item) return false;
    await client.send(new DeleteCommand({ TableName: tableName, Key: { id } }));
    logger.info("reservation cancelled in DynamoDB", { id });
    return true;
  };

  const updateReservation = async (id: string, input: ReservationInput): Promise<Reservation | null> => {
    const existing = await client.send(new GetCommand({ TableName: tableName, Key: { id } }));
    if (!existing.Item) return null;
    const updated: Reservation = { id, ...input };
    await client.send(new PutCommand({ TableName: tableName, Item: updated }));
    logger.info("reservation updated in DynamoDB", { id, ...input });
    return updated;
  };

  return { saveReservation, getReservations, cancelReservation, updateReservation };
};

export default makeDynamoDb;
