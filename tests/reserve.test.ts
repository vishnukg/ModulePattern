import { describe, it, expect, vi } from "vitest";
import makeReserve from "../src/modules/restaurant/reserve.ts";
import type { DB } from "../src/modules/restaurant/types.ts";
import type { Logger } from "../src/modules/logger/types.ts";
import type { Metrics } from "../src/modules/metrics/types.ts";

// Stubs — plain objects used when the test does not care about the interaction.
// Plain functions, not vi.fn(), because there is nothing to assert on them.
const stubDb: DB           = { saveReservation: async () => {}, getReservations: async () => [] };
const stubLogger: Logger   = { info: () => {}, warn: () => {}, error: () => {} };
const stubMetrics: Metrics = { increment: () => {}, timing: () => {} };

describe("reserve — business logic", () => {
  it("returns Accepted when quantity is below table size", async () => {
    // Arrange
    const reserve = makeReserve({ db: stubDb, restaurantCfg: { tableSize: 10 }, logger: stubLogger, metrics: stubMetrics });

    // Act + Assert
    expect(await reserve({ quantity: 8, date: "12/12/12" })).toBe("Accepted");
  });

  it("returns Accepted when quantity exactly equals table size", async () => {
    // Arrange
    const reserve = makeReserve({ db: stubDb, restaurantCfg: { tableSize: 10 }, logger: stubLogger, metrics: stubMetrics });

    // Act + Assert
    expect(await reserve({ quantity: 10, date: "12/12/12" })).toBe("Accepted");
  });

  it("returns Rejected when quantity exceeds table size", async () => {
    // Arrange
    const reserve = makeReserve({ db: stubDb, restaurantCfg: { tableSize: 10 }, logger: stubLogger, metrics: stubMetrics });

    // Act + Assert
    expect(await reserve({ quantity: 11, date: "12/12/12" })).toBe("Rejected");
  });
});

describe("reserve — db interaction", () => {
  it("calls db.saveReservation with the reservation on acceptance", async () => {
    // Arrange — mock because we assert on it
    const mockDb: DB = { saveReservation: vi.fn(async () => {}), getReservations: async () => [] };
    const reserve = makeReserve({ db: mockDb, restaurantCfg: { tableSize: 10 }, logger: stubLogger, metrics: stubMetrics });

    // Act
    await reserve({ quantity: 8, date: "12/12/12" });

    // Assert
    expect(mockDb.saveReservation).toHaveBeenCalledWith({ quantity: 8, date: "12/12/12" });
  });

  it("does not call db.saveReservation on rejection", async () => {
    // Arrange — mock because we assert on it
    const mockDb: DB = { saveReservation: vi.fn(async () => {}), getReservations: async () => [] };
    const reserve = makeReserve({ db: mockDb, restaurantCfg: { tableSize: 10 }, logger: stubLogger, metrics: stubMetrics });

    // Act
    await reserve({ quantity: 11, date: "12/12/12" });

    // Assert
    expect(mockDb.saveReservation).not.toHaveBeenCalled();
  });
});

describe("reserve — logging", () => {
  it("calls logger.info on acceptance, never logger.warn", async () => {
    // Arrange — mock because we assert on it
    const mockLogger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
    const reserve = makeReserve({ db: stubDb, restaurantCfg: { tableSize: 10 }, logger: mockLogger, metrics: stubMetrics });

    // Act
    await reserve({ quantity: 8, date: "12/12/12" });

    // Assert
    expect(mockLogger.info).toHaveBeenCalled();
    expect(mockLogger.warn).not.toHaveBeenCalled();
  });

  it("calls logger.warn on rejection", async () => {
    // Arrange — mock because we assert on it
    const mockLogger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
    const reserve = makeReserve({ db: stubDb, restaurantCfg: { tableSize: 10 }, logger: mockLogger, metrics: stubMetrics });

    // Act
    await reserve({ quantity: 11, date: "12/12/12" });

    // Assert
    expect(mockLogger.warn).toHaveBeenCalledOnce();
  });
});

describe("reserve — metrics", () => {
  it("increments reservation.accepted on acceptance", async () => {
    // Arrange — mock because we assert on it
    const mockMetrics = { increment: vi.fn(), timing: vi.fn() };
    const reserve = makeReserve({ db: stubDb, restaurantCfg: { tableSize: 10 }, logger: stubLogger, metrics: mockMetrics });

    // Act
    await reserve({ quantity: 8, date: "12/12/12" });

    // Assert
    expect(mockMetrics.increment).toHaveBeenCalledWith("reservation.accepted");
  });

  it("increments reservation.rejected on rejection", async () => {
    // Arrange — mock because we assert on it
    const mockMetrics = { increment: vi.fn(), timing: vi.fn() };
    const reserve = makeReserve({ db: stubDb, restaurantCfg: { tableSize: 10 }, logger: stubLogger, metrics: mockMetrics });

    // Act
    await reserve({ quantity: 11, date: "12/12/12" });

    // Assert
    expect(mockMetrics.increment).toHaveBeenCalledWith("reservation.rejected");
  });

  it("records a timing on acceptance", async () => {
    // Arrange — mock because we assert on it
    const mockMetrics = { increment: vi.fn(), timing: vi.fn() };
    const reserve = makeReserve({ db: stubDb, restaurantCfg: { tableSize: 10 }, logger: stubLogger, metrics: mockMetrics });

    // Act
    await reserve({ quantity: 8, date: "12/12/12" });

    // Assert
    expect(mockMetrics.timing).toHaveBeenCalledWith("reservation.duration_ms", expect.any(Number));
  });

  it("records a timing on rejection", async () => {
    // Arrange — mock because we assert on it
    const mockMetrics = { increment: vi.fn(), timing: vi.fn() };
    const reserve = makeReserve({ db: stubDb, restaurantCfg: { tableSize: 10 }, logger: stubLogger, metrics: mockMetrics });

    // Act
    await reserve({ quantity: 11, date: "12/12/12" });

    // Assert
    expect(mockMetrics.timing).toHaveBeenCalledWith("reservation.duration_ms", expect.any(Number));
  });
});
