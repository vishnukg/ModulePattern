import { describe, it, expect, vi } from "vitest";
import { makeUpdate } from "../src/restaurant/index.ts";
import type { DB } from "../src/restaurant/index.ts";
import type { Logger, Metrics } from "../src/restaurant/index.ts";

const updatedReservation = { id: "stub-id", quantity: 4, date: "25/12/12" };

const stubDb: DB = {
    saveReservation: async (input) => ({ id: "stub-id", ...input }),
    getReservations: async () => [],
    cancelReservation: async () => true,
    updateReservation: async () => updatedReservation,
};
const stubLogger: Logger = { info: () => {}, warn: () => {}, error: () => {} };
const stubMetrics: Metrics = { increment: () => {}, timing: () => {} };

describe("makeUpdate — update logic", () => {
    it("returns Updated when the reservation exists and quantity fits", async () => {
        const update = makeUpdate({
            db: stubDb,
            restaurantCfg: { tableSize: 10 },
            logger: stubLogger,
            metrics: stubMetrics,
        });
        expect(await update("any-id", { quantity: 4, date: "25/12/12" })).toBe("Updated");
    });

    it("returns Rejected when quantity exceeds table size", async () => {
        const update = makeUpdate({
            db: stubDb,
            restaurantCfg: { tableSize: 10 },
            logger: stubLogger,
            metrics: stubMetrics,
        });
        expect(await update("any-id", { quantity: 11, date: "25/12/12" })).toBe("Rejected");
    });

    it("returns Updated when quantity exactly equals table size", async () => {
        const update = makeUpdate({
            db: stubDb,
            restaurantCfg: { tableSize: 10 },
            logger: stubLogger,
            metrics: stubMetrics,
        });
        expect(await update("any-id", { quantity: 10, date: "25/12/12" })).toBe("Updated");
    });

    it("returns NotFound when the reservation does not exist", async () => {
        const db: DB = { ...stubDb, updateReservation: async () => null };
        const update = makeUpdate({
            db,
            restaurantCfg: { tableSize: 10 },
            logger: stubLogger,
            metrics: stubMetrics,
        });
        expect(await update("missing-id", { quantity: 4, date: "25/12/12" })).toBe("NotFound");
    });
});

describe("makeUpdate — db interaction", () => {
    it("calls db.updateReservation with the id and input", async () => {
        const mockDb: DB = {
            ...stubDb,
            updateReservation: vi.fn(async () => updatedReservation),
        };
        const update = makeUpdate({
            db: mockDb,
            restaurantCfg: { tableSize: 10 },
            logger: stubLogger,
            metrics: stubMetrics,
        });

        await update("abc-123", { quantity: 4, date: "25/12/12" });

        expect(mockDb.updateReservation).toHaveBeenCalledWith("abc-123", {
            quantity: 4,
            date: "25/12/12",
        });
    });

    it("does not call db.updateReservation when quantity exceeds table size", async () => {
        const mockDb: DB = {
            ...stubDb,
            updateReservation: vi.fn(async () => updatedReservation),
        };
        const update = makeUpdate({
            db: mockDb,
            restaurantCfg: { tableSize: 10 },
            logger: stubLogger,
            metrics: stubMetrics,
        });

        await update("any-id", { quantity: 11, date: "25/12/12" });

        expect(mockDb.updateReservation).not.toHaveBeenCalled();
    });
});

describe("makeUpdate — logging", () => {
    it("calls logger.info on success", async () => {
        const mockLogger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
        const update = makeUpdate({
            db: stubDb,
            restaurantCfg: { tableSize: 10 },
            logger: mockLogger,
            metrics: stubMetrics,
        });

        await update("any-id", { quantity: 4, date: "25/12/12" });

        expect(mockLogger.info).toHaveBeenCalled();
        expect(mockLogger.warn).not.toHaveBeenCalled();
    });

    it("calls logger.warn on rejection", async () => {
        const mockLogger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
        const update = makeUpdate({
            db: stubDb,
            restaurantCfg: { tableSize: 10 },
            logger: mockLogger,
            metrics: stubMetrics,
        });

        await update("any-id", { quantity: 11, date: "25/12/12" });

        expect(mockLogger.warn).toHaveBeenCalledOnce();
    });

    it("calls logger.warn on NotFound", async () => {
        const db: DB = { ...stubDb, updateReservation: async () => null };
        const mockLogger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
        const update = makeUpdate({
            db,
            restaurantCfg: { tableSize: 10 },
            logger: mockLogger,
            metrics: stubMetrics,
        });

        await update("missing-id", { quantity: 4, date: "25/12/12" });

        expect(mockLogger.warn).toHaveBeenCalledOnce();
    });
});

describe("makeUpdate — metrics", () => {
    it("increments reservation.update.accepted on success", async () => {
        const mockMetrics = { increment: vi.fn(), timing: vi.fn() };
        const update = makeUpdate({
            db: stubDb,
            restaurantCfg: { tableSize: 10 },
            logger: stubLogger,
            metrics: mockMetrics,
        });

        await update("any-id", { quantity: 4, date: "25/12/12" });

        expect(mockMetrics.increment).toHaveBeenCalledWith("reservation.update.accepted");
    });

    it("increments reservation.update.rejected on rejection", async () => {
        const mockMetrics = { increment: vi.fn(), timing: vi.fn() };
        const update = makeUpdate({
            db: stubDb,
            restaurantCfg: { tableSize: 10 },
            logger: stubLogger,
            metrics: mockMetrics,
        });

        await update("any-id", { quantity: 11, date: "25/12/12" });

        expect(mockMetrics.increment).toHaveBeenCalledWith("reservation.update.rejected");
    });

    it("records a timing on success", async () => {
        const mockMetrics = { increment: vi.fn(), timing: vi.fn() };
        const update = makeUpdate({
            db: stubDb,
            restaurantCfg: { tableSize: 10 },
            logger: stubLogger,
            metrics: mockMetrics,
        });

        await update("any-id", { quantity: 4, date: "25/12/12" });

        expect(mockMetrics.timing).toHaveBeenCalledWith(
            "reservation.update_ms",
            expect.any(Number),
        );
    });

    it("records a timing on rejection", async () => {
        const mockMetrics = { increment: vi.fn(), timing: vi.fn() };
        const update = makeUpdate({
            db: stubDb,
            restaurantCfg: { tableSize: 10 },
            logger: stubLogger,
            metrics: mockMetrics,
        });

        await update("any-id", { quantity: 11, date: "25/12/12" });

        expect(mockMetrics.timing).toHaveBeenCalledWith(
            "reservation.update_ms",
            expect.any(Number),
        );
    });
});
