import { describe, it, expect, vi } from "vitest";
import { makeRestaurant } from "../src/restaurant/index.ts";
import type { DB } from "../src/restaurant/index.ts";
import type { Logger, Metrics } from "../src/restaurant/index.ts";

// reserve is a method of Restaurant — each test builds a restaurant from its deps
// and destructures the one operation under test.

// Stubs — plain objects used when the test does not care about the interaction.
const stubDb: DB = {
    saveReservation: async (input) => ({ id: "stub-id", ...input }),
    getReservations: async () => [],
    cancelReservation: async () => true,
    updateReservation: async () => null,
};
const stubLogger: Logger = { info: () => {}, warn: () => {}, error: () => {} };
const stubMetrics: Metrics = { increment: () => {}, timing: () => {} };

describe("reserve — business logic", () => {
    it("returns Accepted when quantity is below table size", async () => {
        const { reserve } = makeRestaurant({
            db: stubDb,
            restaurantCfg: { tableSize: 10 },
            logger: stubLogger,
            metrics: stubMetrics,
        });
        expect(await reserve({ quantity: 8, date: "12/12/12" })).toBe("Accepted");
    });

    it("returns Accepted when quantity exactly equals table size", async () => {
        const { reserve } = makeRestaurant({
            db: stubDb,
            restaurantCfg: { tableSize: 10 },
            logger: stubLogger,
            metrics: stubMetrics,
        });
        expect(await reserve({ quantity: 10, date: "12/12/12" })).toBe("Accepted");
    });

    it("returns Rejected when quantity exceeds table size", async () => {
        const { reserve } = makeRestaurant({
            db: stubDb,
            restaurantCfg: { tableSize: 10 },
            logger: stubLogger,
            metrics: stubMetrics,
        });
        expect(await reserve({ quantity: 11, date: "12/12/12" })).toBe("Rejected");
    });
});

describe("reserve — db interaction", () => {
    it("calls db.saveReservation with the reservation on acceptance", async () => {
        const mockDb: DB = {
            saveReservation: vi.fn(async (input) => ({
                id: "mock-id",
                ...input,
            })),
            getReservations: async () => [],
            cancelReservation: async () => true,
            updateReservation: async () => null,
        };
        const { reserve } = makeRestaurant({
            db: mockDb,
            restaurantCfg: { tableSize: 10 },
            logger: stubLogger,
            metrics: stubMetrics,
        });

        await reserve({ quantity: 8, date: "12/12/12" });

        expect(mockDb.saveReservation).toHaveBeenCalledWith({
            quantity: 8,
            date: "12/12/12",
        });
    });

    it("does not call db.saveReservation on rejection", async () => {
        const mockDb: DB = {
            saveReservation: vi.fn(async (input) => ({
                id: "mock-id",
                ...input,
            })),
            getReservations: async () => [],
            cancelReservation: async () => true,
            updateReservation: async () => null,
        };
        const { reserve } = makeRestaurant({
            db: mockDb,
            restaurantCfg: { tableSize: 10 },
            logger: stubLogger,
            metrics: stubMetrics,
        });

        await reserve({ quantity: 11, date: "12/12/12" });

        expect(mockDb.saveReservation).not.toHaveBeenCalled();
    });
});

describe("reserve — logging", () => {
    it("calls logger.info on acceptance, never logger.warn", async () => {
        const mockLogger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
        const { reserve } = makeRestaurant({
            db: stubDb,
            restaurantCfg: { tableSize: 10 },
            logger: mockLogger,
            metrics: stubMetrics,
        });

        await reserve({ quantity: 8, date: "12/12/12" });

        expect(mockLogger.info).toHaveBeenCalled();
        expect(mockLogger.warn).not.toHaveBeenCalled();
    });

    it("calls logger.warn on rejection", async () => {
        const mockLogger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
        const { reserve } = makeRestaurant({
            db: stubDb,
            restaurantCfg: { tableSize: 10 },
            logger: mockLogger,
            metrics: stubMetrics,
        });

        await reserve({ quantity: 11, date: "12/12/12" });

        expect(mockLogger.warn).toHaveBeenCalledOnce();
    });
});

describe("reserve — db error", () => {
    const dbError = new Error("connection refused");
    const failingDb: DB = {
        ...stubDb,
        saveReservation: async () => {
            throw dbError;
        },
    };

    it("re-throws when db.saveReservation throws", async () => {
        const { reserve } = makeRestaurant({
            db: failingDb,
            restaurantCfg: { tableSize: 10 },
            logger: stubLogger,
            metrics: stubMetrics,
        });
        await expect(reserve({ quantity: 8, date: "12/12/12" })).rejects.toThrow(
            "connection refused",
        );
    });

    it("calls logger.error when db.saveReservation throws", async () => {
        const mockLogger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
        const { reserve } = makeRestaurant({
            db: failingDb,
            restaurantCfg: { tableSize: 10 },
            logger: mockLogger,
            metrics: stubMetrics,
        });
        await expect(reserve({ quantity: 8, date: "12/12/12" })).rejects.toThrow();
        expect(mockLogger.error).toHaveBeenCalledWith(
            "db error saving reservation",
            expect.objectContaining({ message: "connection refused" }),
        );
    });

    it("increments reservation.error metric when db.saveReservation throws", async () => {
        const mockMetrics = { increment: vi.fn(), timing: vi.fn() };
        const { reserve } = makeRestaurant({
            db: failingDb,
            restaurantCfg: { tableSize: 10 },
            logger: stubLogger,
            metrics: mockMetrics,
        });
        await expect(reserve({ quantity: 8, date: "12/12/12" })).rejects.toThrow();
        expect(mockMetrics.increment).toHaveBeenCalledWith("reservation.error");
    });

    it("records a timing even when db.saveReservation throws", async () => {
        const mockMetrics = { increment: vi.fn(), timing: vi.fn() };
        const { reserve } = makeRestaurant({
            db: failingDb,
            restaurantCfg: { tableSize: 10 },
            logger: stubLogger,
            metrics: mockMetrics,
        });
        await expect(reserve({ quantity: 8, date: "12/12/12" })).rejects.toThrow();
        expect(mockMetrics.timing).toHaveBeenCalledWith(
            "reservation.duration_ms",
            expect.any(Number),
        );
    });
});

describe("reserve — metrics", () => {
    it("increments reservation.accepted on acceptance", async () => {
        const mockMetrics = { increment: vi.fn(), timing: vi.fn() };
        const { reserve } = makeRestaurant({
            db: stubDb,
            restaurantCfg: { tableSize: 10 },
            logger: stubLogger,
            metrics: mockMetrics,
        });

        await reserve({ quantity: 8, date: "12/12/12" });

        expect(mockMetrics.increment).toHaveBeenCalledWith("reservation.accepted");
    });

    it("increments reservation.rejected on rejection", async () => {
        const mockMetrics = { increment: vi.fn(), timing: vi.fn() };
        const { reserve } = makeRestaurant({
            db: stubDb,
            restaurantCfg: { tableSize: 10 },
            logger: stubLogger,
            metrics: mockMetrics,
        });

        await reserve({ quantity: 11, date: "12/12/12" });

        expect(mockMetrics.increment).toHaveBeenCalledWith("reservation.rejected");
    });

    it("records a timing on acceptance", async () => {
        const mockMetrics = { increment: vi.fn(), timing: vi.fn() };
        const { reserve } = makeRestaurant({
            db: stubDb,
            restaurantCfg: { tableSize: 10 },
            logger: stubLogger,
            metrics: mockMetrics,
        });

        await reserve({ quantity: 8, date: "12/12/12" });

        expect(mockMetrics.timing).toHaveBeenCalledWith(
            "reservation.duration_ms",
            expect.any(Number),
        );
    });

    it("records a timing on rejection", async () => {
        const mockMetrics = { increment: vi.fn(), timing: vi.fn() };
        const { reserve } = makeRestaurant({
            db: stubDb,
            restaurantCfg: { tableSize: 10 },
            logger: stubLogger,
            metrics: mockMetrics,
        });

        await reserve({ quantity: 11, date: "12/12/12" });

        expect(mockMetrics.timing).toHaveBeenCalledWith(
            "reservation.duration_ms",
            expect.any(Number),
        );
    });
});
