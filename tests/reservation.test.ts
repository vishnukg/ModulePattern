import { describe, it, expect, vi } from "vitest";
import makeApp           from "../src/compose.ts";
import makeSilentLogger  from "./helpers/silentLogger.ts";
import makeFakeMetrics   from "./helpers/fakeMetrics.ts";

const silent = () => makeSilentLogger();
const fake   = () => makeFakeMetrics();

// Hoist mock refs so they can be used inside vi.mock() factory (which is itself hoisted).
const { mockConsoleInfo } = vi.hoisted(() => ({ mockConsoleInfo: vi.fn() }));

// Replace the consoleLogger module so makeApp() default uses our spy, not real console.
vi.mock("../src/modules/logger/consoleLogger.ts", () => ({
  default: () => ({ info: mockConsoleInfo, warn: vi.fn(), error: vi.fn() }),
}));

describe("reservations are accepted if we have enough seats at the table", () => {
  it("reserve(10) returns Accepted", async () => {
    // Arrange
    const { restaurant } = makeApp({ restaurantCfg: { tableSize: 12 }, logger: silent(), metrics: fake() });

    // Act + Assert
    expect(await restaurant.reserve({ quantity: 10, date: "12/12/12" })).toBe("Accepted");
  });

  it("reserve(12) returns Accepted", async () => {
    // Arrange
    const { restaurant } = makeApp({ restaurantCfg: { tableSize: 12 }, logger: silent(), metrics: fake() });

    // Act + Assert
    expect(await restaurant.reserve({ quantity: 12, date: "12/12/12" })).toBe("Accepted");
  });

  it("reserve(13) returns Rejected", async () => {
    // Arrange
    const { restaurant } = makeApp({ restaurantCfg: { tableSize: 12 }, logger: silent(), metrics: fake() });

    // Act + Assert
    expect(await restaurant.reserve({ quantity: 13, date: "12/12/12" })).toBe("Rejected");
  });
});

describe("metrics are recorded on each reservation attempt", () => {
  it("increments reservation.accepted on a successful reservation", async () => {
    // Arrange
    const metrics = fake();
    const { restaurant } = makeApp({ restaurantCfg: { tableSize: 12 }, logger: silent(), metrics });

    // Act
    await restaurant.reserve({ quantity: 10, date: "12/12/12" });

    // Assert
    expect(metrics.getCounter("reservation.accepted")).toBe(1);
    expect(metrics.getCounter("reservation.rejected")).toBe(0);
  });

  it("increments reservation.rejected when quantity exceeds table size", async () => {
    // Arrange
    const metrics = fake();
    const { restaurant } = makeApp({ restaurantCfg: { tableSize: 12 }, logger: silent(), metrics });

    // Act
    await restaurant.reserve({ quantity: 13, date: "12/12/12" });

    // Assert
    expect(metrics.getCounter("reservation.rejected")).toBe(1);
    expect(metrics.getCounter("reservation.accepted")).toBe(0);
  });

  it("records a timing for every attempt regardless of outcome", async () => {
    // Arrange
    const metrics = fake();
    const { restaurant } = makeApp({ restaurantCfg: { tableSize: 12 }, logger: silent(), metrics });

    // Act
    await restaurant.reserve({ quantity: 10, date: "12/12/12" });
    await restaurant.reserve({ quantity: 13, date: "12/12/12" });

    // Assert
    expect(metrics.getTimings("reservation.duration_ms")).toHaveLength(2);
  });

  it("getTimings returns empty array before any timing is recorded", () => {
    // Arrange
    const metrics = fake();

    // Assert
    expect(metrics.getTimings("reservation.duration_ms")).toEqual([]);
  });

  it("counters accumulate across multiple calls", async () => {
    // Arrange
    const metrics = fake();
    const { restaurant } = makeApp({ restaurantCfg: { tableSize: 12 }, logger: silent(), metrics });

    // Act
    await restaurant.reserve({ quantity: 10, date: "12/12/12" });
    await restaurant.reserve({ quantity: 10, date: "12/12/12" });
    await restaurant.reserve({ quantity: 13, date: "12/12/12" });

    // Assert
    expect(metrics.getCounter("reservation.accepted")).toBe(2);
    expect(metrics.getCounter("reservation.rejected")).toBe(1);
  });
});

describe("makeApp — defaults", () => {
  it("uses console logger when no logger override is provided", async () => {
    // Arrange
    mockConsoleInfo.mockClear();
    const { restaurant } = makeApp({ restaurantCfg: { tableSize: 12 } });

    // Act
    await restaurant.reserve({ quantity: 10, date: "12/12/12" });

    // Assert
    expect(mockConsoleInfo).toHaveBeenCalled();
  });

  it("works with default db and metrics when no overrides are provided", async () => {
    // Arrange
    const { restaurant } = makeApp({ restaurantCfg: { tableSize: 12 } });

    // Act + Assert
    await expect(restaurant.reserve({ quantity: 10, date: "12/12/12" })).resolves.not.toThrow();
  });
});
