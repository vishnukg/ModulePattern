import { describe, it, expect, vi } from "vitest";
import makeConsoleLogger from "../src/modules/logger/consoleLogger.ts";

describe("consoleLogger — output channel", () => {
  it("info writes to console.log", () => {
    // Arrange
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    const logger = makeConsoleLogger();

    // Act
    logger.info("something happened");

    // Assert
    expect(spy).toHaveBeenCalledOnce();
    spy.mockRestore();
  });

  it("warn writes to console.warn", () => {
    // Arrange
    const spy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const logger = makeConsoleLogger();

    // Act
    logger.warn("something degraded");

    // Assert
    expect(spy).toHaveBeenCalledOnce();
    spy.mockRestore();
  });

  it("error writes to console.error", () => {
    // Arrange
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const logger = makeConsoleLogger();

    // Act
    logger.error("something failed");

    // Assert
    expect(spy).toHaveBeenCalledOnce();
    spy.mockRestore();
  });
});

describe("consoleLogger — output format", () => {
  it("output is valid JSON", () => {
    // Arrange
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    const logger = makeConsoleLogger();

    // Act
    logger.info("msg");

    // Assert
    expect(() => JSON.parse(spy.mock.calls[0]![0] as string)).not.toThrow();
    spy.mockRestore();
  });

  it("info includes level:info and the message", () => {
    // Arrange
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    const logger = makeConsoleLogger();

    // Act
    logger.info("user signed in");

    // Assert
    const output = JSON.parse(spy.mock.calls[0]![0] as string);
    expect(output).toMatchObject({ level: "info", message: "user signed in" });
    spy.mockRestore();
  });

  it("warn includes level:warn and the message", () => {
    // Arrange
    const spy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const logger = makeConsoleLogger();

    // Act
    logger.warn("rate limit approaching");

    // Assert
    const output = JSON.parse(spy.mock.calls[0]![0] as string);
    expect(output).toMatchObject({ level: "warn", message: "rate limit approaching" });
    spy.mockRestore();
  });

  it("error includes level:error and the message", () => {
    // Arrange
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const logger = makeConsoleLogger();

    // Act
    logger.error("db connection lost");

    // Assert
    const output = JSON.parse(spy.mock.calls[0]![0] as string);
    expect(output).toMatchObject({ level: "error", message: "db connection lost" });
    spy.mockRestore();
  });

  it("extra data fields are spread into the output", () => {
    // Arrange
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    const logger = makeConsoleLogger();

    // Act
    logger.info("reservation made", { quantity: 4, date: "12/12/12" });

    // Assert
    const output = JSON.parse(spy.mock.calls[0]![0] as string);
    expect(output).toMatchObject({ quantity: 4, date: "12/12/12" });
    spy.mockRestore();
  });
});
