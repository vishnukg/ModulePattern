import { PutCommand, ScanCommand, DeleteCommand } from "@aws-sdk/lib-dynamodb";
import type { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { ConditionalCheckFailedException } from "@aws-sdk/client-dynamodb";
import type { DB, Reservation, ReservationInput, Logger } from "../../index.ts";

type DynamoDbCfg = {
    tableName: string;
    client: DynamoDBDocumentClient;
    logger: Logger;
    generateId: () => string;
};

const makeDynamoDb = ({ tableName, client, logger, generateId }: DynamoDbCfg): DB => {
    const saveReservation = async (input: ReservationInput): Promise<Reservation> => {
        const reservation: Reservation = { id: generateId(), ...input };
        logger.info("saving reservation to DynamoDB", {
            id: reservation.id,
            ...input,
        });
        await client.send(new PutCommand({ TableName: tableName, Item: reservation }));
        return reservation;
    };

    const getReservations = async (): Promise<Reservation[]> => {
        logger.info("fetching reservations from DynamoDB");
        // A Scan returns at most 1 MB per page; follow LastEvaluatedKey so the
        // full table comes back, not just the first page.
        const reservations: Reservation[] = [];
        let lastEvaluatedKey: Record<string, unknown> | undefined;
        do {
            const result = await client.send(
                new ScanCommand({ TableName: tableName, ExclusiveStartKey: lastEvaluatedKey }),
            );
            for (const item of result.Items ?? []) {
                reservations.push({
                    id: item.id as string,
                    quantity: item.quantity as number,
                    date: item.date as string,
                });
            }
            lastEvaluatedKey = result.LastEvaluatedKey;
        } while (lastEvaluatedKey);
        return reservations;
    };

    const cancelReservation = async (id: string): Promise<boolean> => {
        // ReturnValues: ALL_OLD makes the delete report whether the item existed,
        // in one atomic call — no get-then-delete round trip or race.
        const result = await client.send(
            new DeleteCommand({ TableName: tableName, Key: { id }, ReturnValues: "ALL_OLD" }),
        );
        if (!result.Attributes) return false;
        logger.info("reservation cancelled in DynamoDB", { id });
        return true;
    };

    const updateReservation = async (
        id: string,
        input: ReservationInput,
    ): Promise<Reservation | null> => {
        const updated: Reservation = { id, ...input };
        try {
            // The condition makes the put an atomic update-if-exists rather than
            // an upsert — a missing id fails the write instead of creating an item.
            await client.send(
                new PutCommand({
                    TableName: tableName,
                    Item: updated,
                    ConditionExpression: "attribute_exists(id)",
                }),
            );
        } catch (err) {
            if (err instanceof ConditionalCheckFailedException) return null;
            throw err;
        }
        logger.info("reservation updated in DynamoDB", { id, ...input });
        return updated;
    };

    return {
        saveReservation,
        getReservations,
        cancelReservation,
        updateReservation,
    };
};

export default makeDynamoDb;
