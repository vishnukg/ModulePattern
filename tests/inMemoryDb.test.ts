import { describe, it, expect, vi } from "vitest";
import makeInMemoryDb from "../src/modules/db/makeInMemoryDb.ts";
import type { Logger } from "../src/modules/logger/types.ts";

const stubLogger: Logger = { info: () => {}, warn: () => {}, error: () => {} };

describe("makeInMemoryDb — saveReservation", () => {
  it("returns the saved reservation with a generated id", async () => {
    const db = makeInMemoryDb({ logger: stubLogger });
    const result = await db.saveReservation({ quantity: 5, date: "12/12/12" });
    expect(result).toMatchObject({ quantity: 5, date: "12/12/12" });
    expect(typeof result.id).toBe("string");
    expect(result.id.length).toBeGreaterThan(0);
  });

  it("two saves produce different ids", async () => {
    const db = makeInMemoryDb({ logger: stubLogger });
    const a = await db.saveReservation({ quantity: 2, date: "12/12/12" });
    const b = await db.saveReservation({ quantity: 3, date: "12/12/12" });
    expect(a.id).not.toBe(b.id);
  });
});

describe("makeInMemoryDb — getReservations", () => {
  it("returns all saved reservations in order", async () => {
    const db = makeInMemoryDb({ logger: stubLogger });
    await db.saveReservation({ quantity: 2, date: "12/12/12" });
    await db.saveReservation({ quantity: 4, date: "13/12/12" });
    const result = await db.getReservations();
    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({ quantity: 2, date: "12/12/12" });
    expect(result[1]).toMatchObject({ quantity: 4, date: "13/12/12" });
  });

  it("returns an empty array when nothing has been saved", async () => {
    const db = makeInMemoryDb({ logger: stubLogger });
    expect(await db.getReservations()).toEqual([]);
  });

  it("returns a copy — mutating it does not affect stored state", async () => {
    const db = makeInMemoryDb({ logger: stubLogger });
    await db.saveReservation({ quantity: 1, date: "12/12/12" });
    const first = await db.getReservations();
    first.push({ id: "injected", quantity: 99, date: "corrupted" });
    expect(await db.getReservations()).toHaveLength(1);
  });
});

describe("makeInMemoryDb — cancelReservation", () => {
  it("returns true and removes the reservation when found", async () => {
    const db = makeInMemoryDb({ logger: stubLogger });
    const { id } = await db.saveReservation({ quantity: 2, date: "12/12/12" });

    const result = await db.cancelReservation(id);

    expect(result).toBe(true);
    expect(await db.getReservations()).toHaveLength(0);
  });

  it("returns false when the id does not exist", async () => {
    const db = makeInMemoryDb({ logger: stubLogger });
    expect(await db.cancelReservation("no-such-id")).toBe(false);
  });

  it("only removes the matching reservation", async () => {
    const db = makeInMemoryDb({ logger: stubLogger });
    const a = await db.saveReservation({ quantity: 2, date: "12/12/12" });
    await db.saveReservation({ quantity: 4, date: "13/12/12" });

    await db.cancelReservation(a.id);

    const remaining = await db.getReservations();
    expect(remaining).toHaveLength(1);
    expect(remaining[0]).toMatchObject({ quantity: 4, date: "13/12/12" });
  });
});

describe("makeInMemoryDb — updateReservation", () => {
  it("returns the updated reservation when found", async () => {
    const db = makeInMemoryDb({ logger: stubLogger });
    const { id } = await db.saveReservation({ quantity: 2, date: "12/12/12" });

    const result = await db.updateReservation(id, { quantity: 5, date: "25/12/12" });

    expect(result).toEqual({ id, quantity: 5, date: "25/12/12" });
  });

  it("reflects the update in subsequent getReservations", async () => {
    const db = makeInMemoryDb({ logger: stubLogger });
    const { id } = await db.saveReservation({ quantity: 2, date: "12/12/12" });
    await db.updateReservation(id, { quantity: 5, date: "25/12/12" });
    const [reservation] = await db.getReservations();
    expect(reservation).toEqual({ id, quantity: 5, date: "25/12/12" });
  });

  it("returns null when the id does not exist", async () => {
    const db = makeInMemoryDb({ logger: stubLogger });
    expect(await db.updateReservation("no-such-id", { quantity: 5, date: "25/12/12" })).toBeNull();
  });
});

describe("makeInMemoryDb — isolation", () => {
  it("two instances do not share state", async () => {
    const db1 = makeInMemoryDb({ logger: stubLogger });
    const db2 = makeInMemoryDb({ logger: stubLogger });
    await db1.saveReservation({ quantity: 1, date: "12/12/12" });
    expect(await db2.getReservations()).toHaveLength(0);
  });
});

describe("makeInMemoryDb — logging", () => {
  it("calls logger.info once when saving", async () => {
    const mockLogger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
    const db = makeInMemoryDb({ logger: mockLogger });
    await db.saveReservation({ quantity: 3, date: "12/12/12" });
    expect(mockLogger.info).toHaveBeenCalledOnce();
  });

  it("does not call logger.warn or logger.error when saving", async () => {
    const mockLogger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
    const db = makeInMemoryDb({ logger: mockLogger });
    await db.saveReservation({ quantity: 3, date: "12/12/12" });
    expect(mockLogger.warn).not.toHaveBeenCalled();
    expect(mockLogger.error).not.toHaveBeenCalled();
  });
});
