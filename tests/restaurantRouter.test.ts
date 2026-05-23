import { describe, it, expect, vi } from "vitest";
import express from "express";
import request from "supertest";
import makeRestaurantRouter from "../src/modules/http/makeRestaurantRouter.ts";
import type { Restaurant } from "../src/modules/restaurant/types.ts";

const makeTestApp = (restaurant: Restaurant) => {
  const app = express();
  app.use(express.json());
  app.use("/api", makeRestaurantRouter({ restaurant }));
  return app;
};

describe("makeRestaurantRouter — POST /api/reservations accepted", () => {
  it("returns 201 and result Accepted", async () => {
    // Arrange
    const restaurant: Restaurant = { reserve: async () => "Accepted", getReservations: async () => [] };

    // Act
    const response = await request(makeTestApp(restaurant))
      .post("/api/reservations")
      .send({ quantity: 8, date: "12/12/25" });

    // Assert
    expect(response.status).toBe(201);
    expect(response.body).toEqual({ result: "Accepted" });
  });

  it("calls restaurant.reserve with the parsed body", async () => {
    // Arrange — mock because we assert on it
    const mockReserve = vi.fn(async (): Promise<"Accepted"> => "Accepted");
    const restaurant: Restaurant = { reserve: mockReserve, getReservations: async () => [] };

    // Act
    await request(makeTestApp(restaurant))
      .post("/api/reservations")
      .send({ quantity: 8, date: "12/12/25" });

    // Assert
    expect(mockReserve).toHaveBeenCalledWith({ quantity: 8, date: "12/12/25" });
  });
});

describe("makeRestaurantRouter — POST /api/reservations rejected", () => {
  it("returns 422 and result Rejected", async () => {
    // Arrange
    const restaurant: Restaurant = { reserve: async () => "Rejected", getReservations: async () => [] };

    // Act
    const response = await request(makeTestApp(restaurant))
      .post("/api/reservations")
      .send({ quantity: 15, date: "12/12/25" });

    // Assert
    expect(response.status).toBe(422);
    expect(response.body).toEqual({ result: "Rejected" });
  });
});

describe("makeRestaurantRouter — POST /api/reservations invalid input", () => {
  it("returns 400 when quantity is not a number", async () => {
    // Arrange
    const restaurant: Restaurant = { reserve: async () => "Accepted", getReservations: async () => [] };

    // Act
    const response = await request(makeTestApp(restaurant))
      .post("/api/reservations")
      .send({ quantity: "bad", date: "12/12/25" });

    // Assert
    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty("error");
  });

  it("returns 400 when date is not a string", async () => {
    // Arrange
    const restaurant: Restaurant = { reserve: async () => "Accepted", getReservations: async () => [] };

    // Act
    const response = await request(makeTestApp(restaurant))
      .post("/api/reservations")
      .send({ quantity: 8, date: 999 });

    // Assert
    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty("error");
  });
});

describe("makeRestaurantRouter — GET /api/reservations", () => {
  it("returns all reservations from restaurant.getReservations", async () => {
    // Arrange
    const stored = [{ quantity: 4, date: "12/12/25" }, { quantity: 2, date: "13/12/25" }];
    const restaurant: Restaurant = { reserve: async () => "Accepted", getReservations: async () => stored };

    // Act
    const response = await request(makeTestApp(restaurant))
      .get("/api/reservations");

    // Assert
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ reservations: stored });
  });

  it("returns an empty array when no reservations exist", async () => {
    // Arrange
    const restaurant: Restaurant = { reserve: async () => "Accepted", getReservations: async () => [] };

    // Act
    const response = await request(makeTestApp(restaurant))
      .get("/api/reservations");

    // Assert
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ reservations: [] });
  });
});
