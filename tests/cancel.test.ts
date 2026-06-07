import { describe, it, expect, vi } from "vitest";
import { makeCancel } from "../src/restaurant/index.ts";
import type { DB } from "../src/restaurant/index.ts";
import type { Logger, Metrics } from "../src/restaurant/index.ts";

const stubDb: DB = {
    saveReservation: async (input) => ({ id: "stub-id", ...input }),
    getReservations: async () => [],
    cancelReservation: async () => true,
    updateReservation: async () => null,
};
const stubLogger: Logger = { info: () => {}, warn: () => {}, error: () => {} };
const stubMetrics: Metrics = { increment: () => {}, timing: () => {} };

describe("makeCancel — cancellation logic", () => {
    it("returns Cancelled when the reservation exists", async () => {
        const cancel = makeCancel({
            db: stubDb,
            logger: stubLogger,
            metrics: stubMetrics,
        });
        expect(await cancel("any-id")).toBe("Cancelled");
    });

    it("returns NotFound when the reservation does not exist", async () => {
        const db: DB = { ...stubDb, cancelReservation: async () => false };
        const cancel = makeCancel({
            db,
            logger: stubLogger,
            metrics: stubMetrics,
        });
        expect(await cancel("missing-id")).toBe("NotFound");
    });
});

describe("makeCancel — db interaction", () => {
    it("calls db.cancelReservation with the id", async () => {
        const mockDb: DB = {
            ...stubDb,
            cancelReservation: vi.fn(async () => true),
        };
        const cancel = makeCancel({
            db: mockDb,
            logger: stubLogger,
            metrics: stubMetrics,
        });

        await cancel("abc-123");

        expect(mockDb.cancelReservation).toHaveBeenCalledWith("abc-123");
    });
});

describe("makeCancel — logging", () => {
    it("calls logger.info on successful cancellation", async () => {
        const mockLogger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
        const cancel = makeCancel({
            db: stubDb,
            logger: mockLogger,
            metrics: stubMetrics,
        });

        await cancel("any-id");

        expect(mockLogger.info).toHaveBeenCalled();
        expect(mockLogger.warn).not.toHaveBeenCalled();
    });

    it("calls logger.warn when not found", async () => {
        const db: DB = { ...stubDb, cancelReservation: async () => false };
        const mockLogger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
        const cancel = makeCancel({
            db,
            logger: mockLogger,
            metrics: stubMetrics,
        });

        await cancel("missing-id");

        expect(mockLogger.warn).toHaveBeenCalledOnce();
    });
});

describe("makeCancel — metrics", () => {
    it("increments reservation.cancelled on success", async () => {
        const mockMetrics = { increment: vi.fn(), timing: vi.fn() };
        const cancel = makeCancel({
            db: stubDb,
            logger: stubLogger,
            metrics: mockMetrics,
        });

        await cancel("any-id");

        expect(mockMetrics.increment).toHaveBeenCalledWith("reservation.cancelled");
    });

    it("does not increment on NotFound", async () => {
        const db: DB = { ...stubDb, cancelReservation: async () => false };
        const mockMetrics = { increment: vi.fn(), timing: vi.fn() };
        const cancel = makeCancel({
            db,
            logger: stubLogger,
            metrics: mockMetrics,
        });

        await cancel("missing-id");

        expect(mockMetrics.increment).not.toHaveBeenCalled();
    });

    it("records a timing for every attempt regardless of outcome", async () => {
        const db: DB = { ...stubDb, cancelReservation: async () => false };
        const mockMetrics = { increment: vi.fn(), timing: vi.fn() };
        const cancel = makeCancel({
            db,
            logger: stubLogger,
            metrics: mockMetrics,
        });

        await cancel("found-id");
        await cancel("missing-id");

        expect(mockMetrics.timing).toHaveBeenCalledTimes(2);
        expect(mockMetrics.timing).toHaveBeenCalledWith(
            "reservation.cancel_ms",
            expect.any(Number),
        );
    });
});
