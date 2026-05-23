import { describe, it, expect, vi } from "vitest";
import makeInMemoryDb from "../src/modules/db/makeInMemoryDb.ts";
import type { Logger } from "../src/modules/logger/types.ts";

const stubLogger: Logger = { info: () => {}, warn: () => {}, error: () => {} };

describe("makeInMemoryDb — storage", () => {
  it("saves a reservation and returns it from getReservations", async () => {
    const db = makeInMemoryDb({ logger: stubLogger });

    await db.saveReservation({ quantity: 5, date: "12/12/12" });
    const result = await db.getReservations();

    expect(result).toEqual([{ quantity: 5, date: "12/12/12" }]);
  });

  it("accumulates multiple reservations in order", async () => {
    const db = makeInMemoryDb({ logger: stubLogger });

    await db.saveReservation({ quantity: 2, date: "12/12/12" });
    await db.saveReservation({ quantity: 4, date: "13/12/12" });
    const result = await db.getReservations();

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ quantity: 2, date: "12/12/12" });
    expect(result[1]).toEqual({ quantity: 4, date: "13/12/12" });
  });

  it("getReservations returns a copy — mutating it does not affect stored state", async () => {
    const db = makeInMemoryDb({ logger: stubLogger });

    await db.saveReservation({ quantity: 1, date: "12/12/12" });
    const first = await db.getReservations();
    first.push({ quantity: 99, date: "corrupted" });

    const second = await db.getReservations();
    expect(second).toHaveLength(1);
  });
});

describe("makeInMemoryDb — isolation", () => {
  it("two instances do not share state", async () => {
    const db1 = makeInMemoryDb({ logger: stubLogger });
    const db2 = makeInMemoryDb({ logger: stubLogger });

    await db1.saveReservation({ quantity: 1, date: "12/12/12" });
    const result = await db2.getReservations();

    expect(result).toHaveLength(0);
  });
});

describe("makeInMemoryDb — logging", () => {
  it("calls logger.info once when saving", async () => {
    // Arrange — mock because we assert on it
    const mockLogger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
    const db = makeInMemoryDb({ logger: mockLogger });

    // Act
    await db.saveReservation({ quantity: 3, date: "12/12/12" });

    // Assert
    expect(mockLogger.info).toHaveBeenCalledOnce();
  });

  it("does not call logger.warn or logger.error when saving", async () => {
    // Arrange — mock because we assert on it
    const mockLogger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
    const db = makeInMemoryDb({ logger: mockLogger });

    // Act
    await db.saveReservation({ quantity: 3, date: "12/12/12" });

    // Assert
    expect(mockLogger.warn).not.toHaveBeenCalled();
    expect(mockLogger.error).not.toHaveBeenCalled();
  });
});
