import { PutCommand, ScanCommand, GetCommand, DeleteCommand } from "@aws-sdk/lib-dynamodb";
import type { DynamoDBDocumentClient }                        from "@aws-sdk/lib-dynamodb";
import type { DB, Reservation, ReservationInput }            from "../restaurant/types.ts";
import type { Logger }                                        from "../shared/index.ts";

type DynamoDbCfg = {
  tableName:  string;
  client:     DynamoDBDocumentClient;
  logger:     Logger;
  generateId: () => string;
};

const makeDynamoDb = ({ tableName, client, logger, generateId }: DynamoDbCfg): DB => {
  const saveReservation = async (input: ReservationInput): Promise<Reservation> => {
    const reservation: Reservation = { id: generateId(), ...input };
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
