import { describe, it, expect, vi } from "vitest";
import saveReservation from "../src/modules/db/saveReservation.ts";
import type { Logger } from "../src/modules/logger/types.ts";

// Stub — plain object used when the test does not care about logger interactions.
const stubLogger: Logger = { info: () => {}, warn: () => {}, error: () => {} };

describe("saveReservation — storage", () => {
  it("saves a reservation and returns it in the array", () => {
    const save = saveReservation({ logger: stubLogger });

    const result = save({ quantity: 5, date: "12/12/12" });

    expect(result).toEqual([{ quantity: 5, date: "12/12/12" }]);
  });

  it("accumulates multiple reservations in order", () => {
    const save = saveReservation({ logger: stubLogger });

    save({ quantity: 2, date: "12/12/12" });
    const result = save({ quantity: 4, date: "13/12/12" });

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ quantity: 2, date: "12/12/12" });
    expect(result[1]).toEqual({ quantity: 4, date: "13/12/12" });
  });
});

describe("saveReservation — isolation", () => {
  it("two instances do not share state", () => {
    const save1 = saveReservation({ logger: stubLogger });
    const save2 = saveReservation({ logger: stubLogger });

    save1({ quantity: 1, date: "12/12/12" });
    const result = save2({ quantity: 2, date: "12/12/12" });

    expect(result).toHaveLength(1);
  });
});

describe("saveReservation — logging", () => {
  it("calls logger.info once when saving", () => {
    // Arrange — mock because we assert on it
    const mockLogger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
    const save = saveReservation({ logger: mockLogger });

    // Act
    save({ quantity: 3, date: "12/12/12" });

    // Assert
    expect(mockLogger.info).toHaveBeenCalledOnce();
  });

  it("does not call logger.warn or logger.error", () => {
    // Arrange — mock because we assert on it
    const mockLogger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
    const save = saveReservation({ logger: mockLogger });

    // Act
    save({ quantity: 3, date: "12/12/12" });

    // Assert
    expect(mockLogger.warn).not.toHaveBeenCalled();
    expect(mockLogger.error).not.toHaveBeenCalled();
  });
});
