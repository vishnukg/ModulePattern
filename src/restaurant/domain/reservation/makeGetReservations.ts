import type { GetReservationsFn } from "../types.ts";
import type { DB } from "../../ports/index.ts";

type GetReservationsCfg = { db: DB };

// Listing reservations adds no domain logic today — it is exactly what the DB
// already does. We still wrap it in a factory (rather than wiring
// db.getReservations straight through) so every domain operation is built the
// same way, and so this stays the single place to add a filter, pagination, an
// audit log, or a metric later.
const makeGetReservations = ({ db }: GetReservationsCfg): GetReservationsFn => {
    return () => db.getReservations();
};

export default makeGetReservations;
