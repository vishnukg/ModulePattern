import { describe, it, expect, vi } from "vitest";
import compose from "../src/compose.ts";
import modules from "../src/modules/index.ts";

const silent = () => modules.logger.silentLogger();
const fake   = () => modules.metrics.fakeMetrics();

// Hoist mock refs so they can be used inside vi.mock() factory (which is itself hoisted).
const { mockConsoleInfo } = vi.hoisted(() => ({ mockConsoleInfo: vi.fn() }));

// Replace the consoleLogger module so compose() default uses our spy, not real console.
vi.mock("../src/modules/logger/consoleLogger.ts", () => ({
  default: () => ({ info: mockConsoleInfo, warn: vi.fn(), error: vi.fn() }),
}));

describe("reservations are accepted if we have enough seats at the table", () => {
  it("reserve(10) returns Accepted", () => {
    // Arrange
    const { restaurant } = compose({ restaurantCfg: { tableSize: 12 }, logger: silent(), metrics: fake() });

    // Act + Assert
    expect(restaurant.reserve({ quantity: 10, date: "12/12/12" })).toBe("Accepted");
  });

  it("reserve(12) returns Accepted", () => {
    // Arrange
    const { restaurant } = compose({ restaurantCfg: { tableSize: 12 }, logger: silent(), metrics: fake() });

    // Act + Assert
    expect(restaurant.reserve({ quantity: 12, date: "12/12/12" })).toBe("Accepted");
  });

  it("reserve(13) returns Rejected", () => {
    // Arrange
    const { restaurant } = compose({ restaurantCfg: { tableSize: 12 }, logger: silent(), metrics: fake() });

    // Act + Assert
    expect(restaurant.reserve({ quantity: 13, date: "12/12/12" })).toBe("Rejected");
  });
});

describe("metrics are recorded on each reservation attempt", () => {
  it("increments reservation.accepted on a successful reservation", () => {
    // Arrange
    const metrics = fake();
    const { restaurant } = compose({ restaurantCfg: { tableSize: 12 }, logger: silent(), metrics });

    // Act
    restaurant.reserve({ quantity: 10, date: "12/12/12" });

    // Assert
    expect(metrics.getCounter("reservation.accepted")).toBe(1);
    expect(metrics.getCounter("reservation.rejected")).toBe(0);
  });

  it("increments reservation.rejected when quantity exceeds table size", () => {
    // Arrange
    const metrics = fake();
    const { restaurant } = compose({ restaurantCfg: { tableSize: 12 }, logger: silent(), metrics });

    // Act
    restaurant.reserve({ quantity: 13, date: "12/12/12" });

    // Assert
    expect(metrics.getCounter("reservation.rejected")).toBe(1);
    expect(metrics.getCounter("reservation.accepted")).toBe(0);
  });

  it("records a timing for every attempt regardless of outcome", () => {
    // Arrange
    const metrics = fake();
    const { restaurant } = compose({ restaurantCfg: { tableSize: 12 }, logger: silent(), metrics });

    // Act
    restaurant.reserve({ quantity: 10, date: "12/12/12" });
    restaurant.reserve({ quantity: 13, date: "12/12/12" });

    // Assert
    expect(metrics.getTimings("reservation.duration_ms")).toHaveLength(2);
  });

  it("getTimings returns empty array before any timing is recorded", () => {
    // Arrange
    const metrics = fake();

    // Assert
    expect(metrics.getTimings("reservation.duration_ms")).toEqual([]);
  });

  it("counters accumulate across multiple calls", () => {
    // Arrange
    const metrics = fake();
    const { restaurant } = compose({ restaurantCfg: { tableSize: 12 }, logger: silent(), metrics });

    // Act
    restaurant.reserve({ quantity: 10, date: "12/12/12" });
    restaurant.reserve({ quantity: 10, date: "12/12/12" });
    restaurant.reserve({ quantity: 13, date: "12/12/12" });

    // Assert
    expect(metrics.getCounter("reservation.accepted")).toBe(2);
    expect(metrics.getCounter("reservation.rejected")).toBe(1);
  });
});

describe("compose — defaults", () => {
  it("uses console logger when no logger override is provided", () => {
    // Arrange
    mockConsoleInfo.mockClear();
    const { restaurant } = compose({ restaurantCfg: { tableSize: 12 } });

    // Act
    restaurant.reserve({ quantity: 10, date: "12/12/12" });

    // Assert
    expect(mockConsoleInfo).toHaveBeenCalled();
  });

  it("works with default metrics when no metrics override is provided", () => {
    // Arrange
    const { restaurant } = compose({ restaurantCfg: { tableSize: 12 } });

    // Act + Assert
    expect(() => restaurant.reserve({ quantity: 10, date: "12/12/12" })).not.toThrow();
  });
});
