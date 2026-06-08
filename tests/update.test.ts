import { describe, it, expect, vi } from "vitest";
import { makeRestaurant } from "../src/restaurant/index.ts";
import type { DB } from "../src/restaurant/index.ts";
import type { Logger, Metrics } from "../src/restaurant/index.ts";

// update is a method of Restaurant — each test builds a restaurant from its deps
// and destructures the one operation under test.

const updatedReservation = { id: "stub-id", quantity: 4, date: "25/12/12" };

const stubDb: DB = {
    saveReservation: async (input) => ({ id: "stub-id", ...input }),
    getReservations: async () => [],
    cancelReservation: async () => true,
    updateReservation: async () => updatedReservation,
};
const stubLogger: Logger = { info: () => {}, warn: () => {}, error: () => {} };
const stubMetrics: Metrics = { increment: () => {}, timing: () => {} };

describe("update — update logic", () => {
    it("returns Updated when the reservation exists and quantity fits", async () => {
        const { update } = makeRestaurant({
            db: stubDb,
            restaurantCfg: { tableSize: 10 },
            logger: stubLogger,
            metrics: stubMetrics,
        });
        expect(await update("any-id", { quantity: 4, date: "25/12/12" })).toBe("Updated");
    });

    it("returns Rejected when quantity exceeds table size", async () => {
        const { update } = makeRestaurant({
            db: stubDb,
            restaurantCfg: { tableSize: 10 },
            logger: stubLogger,
            metrics: stubMetrics,
        });
        expect(await update("any-id", { quantity: 11, date: "25/12/12" })).toBe("Rejected");
    });

    it("returns Updated when quantity exactly equals table size", async () => {
        const { update } = makeRestaurant({
            db: stubDb,
            restaurantCfg: { tableSize: 10 },
            logger: stubLogger,
            metrics: stubMetrics,
        });
        expect(await update("any-id", { quantity: 10, date: "25/12/12" })).toBe("Updated");
    });

    it("returns NotFound when the reservation does not exist", async () => {
        const db: DB = { ...stubDb, updateReservation: async () => null };
        const { update } = makeRestaurant({
            db,
            restaurantCfg: { tableSize: 10 },
            logger: stubLogger,
            metrics: stubMetrics,
        });
        expect(await update("missing-id", { quantity: 4, date: "25/12/12" })).toBe("NotFound");
    });
});

describe("update — db interaction", () => {
    it("calls db.updateReservation with the id and input", async () => {
        const mockDb: DB = {
            ...stubDb,
            updateReservation: vi.fn(async () => updatedReservation),
        };
        const { update } = makeRestaurant({
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
        const { update } = makeRestaurant({
            db: mockDb,
            restaurantCfg: { tableSize: 10 },
            logger: stubLogger,
            metrics: stubMetrics,
        });

        await update("any-id", { quantity: 11, date: "25/12/12" });

        expect(mockDb.updateReservation).not.toHaveBeenCalled();
    });
});

describe("update — logging", () => {
    it("calls logger.info on success", async () => {
        const mockLogger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
        const { update } = makeRestaurant({
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
        const { update } = makeRestaurant({
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
        const { update } = makeRestaurant({
            db,
            restaurantCfg: { tableSize: 10 },
            logger: mockLogger,
            metrics: stubMetrics,
        });

        await update("missing-id", { quantity: 4, date: "25/12/12" });

        expect(mockLogger.warn).toHaveBeenCalledOnce();
    });
});

describe("update — db error", () => {
    const dbError = new Error("connection refused");
    const failingDb: DB = {
        ...stubDb,
        updateReservation: async () => {
            throw dbError;
        },
    };

    it("re-throws when db.updateReservation throws", async () => {
        const { update } = makeRestaurant({
            db: failingDb,
            restaurantCfg: { tableSize: 10 },
            logger: stubLogger,
            metrics: stubMetrics,
        });
        await expect(update("any-id", { quantity: 4, date: "25/12/12" })).rejects.toThrow(
            "connection refused",
        );
    });

    it("calls logger.error when db.updateReservation throws", async () => {
        const mockLogger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
        const { update } = makeRestaurant({
            db: failingDb,
            restaurantCfg: { tableSize: 10 },
            logger: mockLogger,
            metrics: stubMetrics,
        });
        await expect(update("any-id", { quantity: 4, date: "25/12/12" })).rejects.toThrow();
        expect(mockLogger.error).toHaveBeenCalledWith(
            "db error updating reservation",
            expect.objectContaining({ id: "any-id", message: "connection refused" }),
        );
    });

    it("increments reservation.update.error metric when db.updateReservation throws", async () => {
        const mockMetrics = { increment: vi.fn(), timing: vi.fn() };
        const { update } = makeRestaurant({
            db: failingDb,
            restaurantCfg: { tableSize: 10 },
            logger: stubLogger,
            metrics: mockMetrics,
        });
        await expect(update("any-id", { quantity: 4, date: "25/12/12" })).rejects.toThrow();
        expect(mockMetrics.increment).toHaveBeenCalledWith("reservation.update.error");
    });

    it("records a timing even when db.updateReservation throws", async () => {
        const mockMetrics = { increment: vi.fn(), timing: vi.fn() };
        const { update } = makeRestaurant({
            db: failingDb,
            restaurantCfg: { tableSize: 10 },
            logger: stubLogger,
            metrics: mockMetrics,
        });
        await expect(update("any-id", { quantity: 4, date: "25/12/12" })).rejects.toThrow();
        expect(mockMetrics.timing).toHaveBeenCalledWith(
            "reservation.update_ms",
            expect.any(Number),
        );
    });
});

describe("update — metrics", () => {
    it("increments reservation.update.accepted on success", async () => {
        const mockMetrics = { increment: vi.fn(), timing: vi.fn() };
        const { update } = makeRestaurant({
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
        const { update } = makeRestaurant({
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
        const { update } = makeRestaurant({
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
        const { update } = makeRestaurant({
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
