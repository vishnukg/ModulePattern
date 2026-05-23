import { describe, it, expect, vi } from "vitest";
import reserve from "../src/modules/restaurant/reserve.ts";
import type { DB } from "../src/modules/db/types.ts";
import type { Logger } from "../src/modules/logger/types.ts";
import type { Metrics } from "../src/modules/metrics/types.ts";

// Stubs — plain objects used when the test does not care about the interaction.
// Plain functions, not vi.fn(), because there is nothing to assert on them.
const stubDb: DB           = { saveReservation: () => [] };
const stubLogger: Logger   = { info: () => {}, warn: () => {}, error: () => {} };
const stubMetrics: Metrics = { increment: () => {}, timing: () => {} };

describe("reserve — business logic", () => {
  it("returns Accepted when quantity is below table size", () => {
    // Arrange
    const doReserve = reserve({ db: stubDb, restaurantCfg: { tableSize: 10 }, logger: stubLogger, metrics: stubMetrics });

    // Act + Assert
    expect(doReserve({ quantity: 8, date: "12/12/12" })).toBe("Accepted");
  });

  it("returns Accepted when quantity exactly equals table size", () => {
    // Arrange
    const doReserve = reserve({ db: stubDb, restaurantCfg: { tableSize: 10 }, logger: stubLogger, metrics: stubMetrics });

    // Act + Assert
    expect(doReserve({ quantity: 10, date: "12/12/12" })).toBe("Accepted");
  });

  it("returns Rejected when quantity exceeds table size", () => {
    // Arrange
    const doReserve = reserve({ db: stubDb, restaurantCfg: { tableSize: 10 }, logger: stubLogger, metrics: stubMetrics });

    // Act + Assert
    expect(doReserve({ quantity: 11, date: "12/12/12" })).toBe("Rejected");
  });
});

describe("reserve — db interaction", () => {
  it("calls db.saveReservation with the reservation on acceptance", () => {
    // Arrange — mock because we assert on it
    const mockDb = { saveReservation: vi.fn() };
    const doReserve = reserve({ db: mockDb, restaurantCfg: { tableSize: 10 }, logger: stubLogger, metrics: stubMetrics });

    // Act
    doReserve({ quantity: 8, date: "12/12/12" });

    // Assert
    expect(mockDb.saveReservation).toHaveBeenCalledWith({ quantity: 8, date: "12/12/12" });
  });

  it("does not call db.saveReservation on rejection", () => {
    // Arrange — mock because we assert on it
    const mockDb = { saveReservation: vi.fn() };
    const doReserve = reserve({ db: mockDb, restaurantCfg: { tableSize: 10 }, logger: stubLogger, metrics: stubMetrics });

    // Act
    doReserve({ quantity: 11, date: "12/12/12" });

    // Assert
    expect(mockDb.saveReservation).not.toHaveBeenCalled();
  });
});

describe("reserve — logging", () => {
  it("calls logger.info on acceptance, never logger.warn", () => {
    // Arrange — mock because we assert on it
    const mockLogger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
    const doReserve = reserve({ db: stubDb, restaurantCfg: { tableSize: 10 }, logger: mockLogger, metrics: stubMetrics });

    // Act
    doReserve({ quantity: 8, date: "12/12/12" });

    // Assert
    expect(mockLogger.info).toHaveBeenCalled();
    expect(mockLogger.warn).not.toHaveBeenCalled();
  });

  it("calls logger.warn on rejection", () => {
    // Arrange — mock because we assert on it
    const mockLogger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
    const doReserve = reserve({ db: stubDb, restaurantCfg: { tableSize: 10 }, logger: mockLogger, metrics: stubMetrics });

    // Act
    doReserve({ quantity: 11, date: "12/12/12" });

    // Assert
    expect(mockLogger.warn).toHaveBeenCalledOnce();
  });
});

describe("reserve — metrics", () => {
  it("increments reservation.accepted on acceptance", () => {
    // Arrange — mock because we assert on it
    const mockMetrics = { increment: vi.fn(), timing: vi.fn() };
    const doReserve = reserve({ db: stubDb, restaurantCfg: { tableSize: 10 }, logger: stubLogger, metrics: mockMetrics });

    // Act
    doReserve({ quantity: 8, date: "12/12/12" });

    // Assert
    expect(mockMetrics.increment).toHaveBeenCalledWith("reservation.accepted");
  });

  it("increments reservation.rejected on rejection", () => {
    // Arrange — mock because we assert on it
    const mockMetrics = { increment: vi.fn(), timing: vi.fn() };
    const doReserve = reserve({ db: stubDb, restaurantCfg: { tableSize: 10 }, logger: stubLogger, metrics: mockMetrics });

    // Act
    doReserve({ quantity: 11, date: "12/12/12" });

    // Assert
    expect(mockMetrics.increment).toHaveBeenCalledWith("reservation.rejected");
  });

  it("records a timing on acceptance", () => {
    // Arrange — mock because we assert on it
    const mockMetrics = { increment: vi.fn(), timing: vi.fn() };
    const doReserve = reserve({ db: stubDb, restaurantCfg: { tableSize: 10 }, logger: stubLogger, metrics: mockMetrics });

    // Act
    doReserve({ quantity: 8, date: "12/12/12" });

    // Assert
    expect(mockMetrics.timing).toHaveBeenCalledWith("reservation.duration_ms", expect.any(Number));
  });

  it("records a timing on rejection", () => {
    // Arrange — mock because we assert on it
    const mockMetrics = { increment: vi.fn(), timing: vi.fn() };
    const doReserve = reserve({ db: stubDb, restaurantCfg: { tableSize: 10 }, logger: stubLogger, metrics: mockMetrics });

    // Act
    doReserve({ quantity: 11, date: "12/12/12" });

    // Assert
    expect(mockMetrics.timing).toHaveBeenCalledWith("reservation.duration_ms", expect.any(Number));
  });
});
