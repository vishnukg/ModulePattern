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

const stubRestaurant: Restaurant = {
  reserve:         async () => "Accepted",
  cancel:          async () => "Cancelled",
  update:          async () => "Updated",
  getReservations: async () => [],
};

// ─── POST /api/reservations ───────────────────────────────────────────────────

describe("POST /api/reservations — accepted", () => {
  it("returns 201 and result Accepted", async () => {
    const response = await request(makeTestApp(stubRestaurant))
      .post("/api/reservations")
      .send({ quantity: 8, date: "12/12/25" });

    expect(response.status).toBe(201);
    expect(response.body).toEqual({ result: "Accepted" });
  });

  it("calls restaurant.reserve with the parsed body", async () => {
    const mockReserve = vi.fn(async (): Promise<"Accepted"> => "Accepted");
    const restaurant: Restaurant = { ...stubRestaurant, reserve: mockReserve };

    await request(makeTestApp(restaurant))
      .post("/api/reservations")
      .send({ quantity: 8, date: "12/12/25" });

    expect(mockReserve).toHaveBeenCalledWith({ quantity: 8, date: "12/12/25" });
  });
});

describe("POST /api/reservations — rejected", () => {
  it("returns 422 and result Rejected", async () => {
    const restaurant: Restaurant = { ...stubRestaurant, reserve: async () => "Rejected" };

    const response = await request(makeTestApp(restaurant))
      .post("/api/reservations")
      .send({ quantity: 15, date: "12/12/25" });

    expect(response.status).toBe(422);
    expect(response.body).toEqual({ result: "Rejected" });
  });
});

describe("POST /api/reservations — invalid input", () => {
  it("returns 400 when quantity is not a number", async () => {
    const response = await request(makeTestApp(stubRestaurant))
      .post("/api/reservations")
      .send({ quantity: "bad", date: "12/12/25" });

    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty("error");
  });

  it("returns 400 when date is not a string", async () => {
    const response = await request(makeTestApp(stubRestaurant))
      .post("/api/reservations")
      .send({ quantity: 8, date: 999 });

    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty("error");
  });
});

// ─── GET /api/reservations ────────────────────────────────────────────────────

describe("GET /api/reservations", () => {
  it("returns all reservations from restaurant.getReservations", async () => {
    const stored = [
      { id: "1", quantity: 4, date: "12/12/25" },
      { id: "2", quantity: 2, date: "13/12/25" },
    ];
    const restaurant: Restaurant = { ...stubRestaurant, getReservations: async () => stored };

    const response = await request(makeTestApp(restaurant)).get("/api/reservations");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ reservations: stored });
  });

  it("returns an empty array when no reservations exist", async () => {
    const response = await request(makeTestApp(stubRestaurant)).get("/api/reservations");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ reservations: [] });
  });
});

// ─── DELETE /api/reservations/:id ─────────────────────────────────────────────

describe("DELETE /api/reservations/:id — cancelled", () => {
  it("returns 200 and result Cancelled", async () => {
    const response = await request(makeTestApp(stubRestaurant))
      .delete("/api/reservations/some-id");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ result: "Cancelled" });
  });

  it("calls restaurant.cancel with the id from the URL", async () => {
    const mockCancel = vi.fn(async (): Promise<"Cancelled"> => "Cancelled");
    const restaurant: Restaurant = { ...stubRestaurant, cancel: mockCancel };

    await request(makeTestApp(restaurant)).delete("/api/reservations/abc-123");

    expect(mockCancel).toHaveBeenCalledWith("abc-123");
  });
});

describe("DELETE /api/reservations/:id — not found", () => {
  it("returns 404 and result NotFound", async () => {
    const restaurant: Restaurant = { ...stubRestaurant, cancel: async () => "NotFound" };

    const response = await request(makeTestApp(restaurant))
      .delete("/api/reservations/no-such-id");

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ result: "NotFound" });
  });
});

// ─── PUT /api/reservations/:id ────────────────────────────────────────────────

describe("PUT /api/reservations/:id — updated", () => {
  it("returns 200 and result Updated", async () => {
    const response = await request(makeTestApp(stubRestaurant))
      .put("/api/reservations/some-id")
      .send({ quantity: 4, date: "25/12/25" });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ result: "Updated" });
  });

  it("calls restaurant.update with the id from the URL and parsed body", async () => {
    const mockUpdate = vi.fn(async (): Promise<"Updated"> => "Updated");
    const restaurant: Restaurant = { ...stubRestaurant, update: mockUpdate };

    await request(makeTestApp(restaurant))
      .put("/api/reservations/abc-123")
      .send({ quantity: 4, date: "25/12/25" });

    expect(mockUpdate).toHaveBeenCalledWith("abc-123", { quantity: 4, date: "25/12/25" });
  });
});

describe("PUT /api/reservations/:id — rejected", () => {
  it("returns 422 and result Rejected", async () => {
    const restaurant: Restaurant = { ...stubRestaurant, update: async () => "Rejected" };

    const response = await request(makeTestApp(restaurant))
      .put("/api/reservations/some-id")
      .send({ quantity: 99, date: "25/12/25" });

    expect(response.status).toBe(422);
    expect(response.body).toEqual({ result: "Rejected" });
  });
});

describe("PUT /api/reservations/:id — not found", () => {
  it("returns 404 and result NotFound", async () => {
    const restaurant: Restaurant = { ...stubRestaurant, update: async () => "NotFound" };

    const response = await request(makeTestApp(restaurant))
      .put("/api/reservations/no-such-id")
      .send({ quantity: 4, date: "25/12/25" });

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ result: "NotFound" });
  });
});

describe("PUT /api/reservations/:id — invalid input", () => {
  it("returns 400 when quantity is not a number", async () => {
    const response = await request(makeTestApp(stubRestaurant))
      .put("/api/reservations/some-id")
      .send({ quantity: "bad", date: "25/12/25" });

    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty("error");
  });
});
