import { describe, it, expect, vi } from "vitest";
import makeRestaurantCli from "../src/restaurant/adapters/cli/makeRestaurantCli.ts";
import type { Restaurant } from "../src/restaurant/index.ts";

const makeStubRestaurant = (overrides: Partial<Restaurant> = {}): Restaurant => ({
    reserve: async () => "Accepted",
    cancel: async () => "Cancelled",
    update: async () => "Updated",
    getReservations: async () => [],
    ...overrides,
});

describe("makeRestaurantCli — reserve", () => {
    it("calls the Restaurant port with the parsed input", async () => {
        const reserve = vi.fn(async () => "Accepted" as const);
        const cli = makeRestaurantCli({ restaurant: makeStubRestaurant({ reserve }) });

        await cli.reserve({ quantity: 4, date: "2026-06-08" }, 10);

        expect(reserve).toHaveBeenCalledWith({ quantity: 4, date: "2026-06-08" });
    });

    it("renders an accepted reservation as a line of text", async () => {
        const cli = makeRestaurantCli({
            restaurant: makeStubRestaurant({ reserve: async () => "Accepted" }),
        });

        const message = await cli.reserve({ quantity: 4, date: "2026-06-08" }, 10);

        expect(message).toBe("Reservation Accepted — 4 seat(s) on 2026-06-08 (table size: 10)");
    });

    it("renders a rejected reservation as a line of text", async () => {
        const cli = makeRestaurantCli({
            restaurant: makeStubRestaurant({ reserve: async () => "Rejected" }),
        });

        const message = await cli.reserve({ quantity: 99, date: "2026-06-08" }, 10);

        expect(message).toBe("Reservation Rejected — 99 seat(s) on 2026-06-08 (table size: 10)");
    });
});

describe("makeRestaurantCli — cancel", () => {
    it("calls the Restaurant port with the id", async () => {
        const cancel = vi.fn(async () => "Cancelled" as const);
        const cli = makeRestaurantCli({ restaurant: makeStubRestaurant({ cancel }) });

        await cli.cancel("abc123");

        expect(cancel).toHaveBeenCalledWith("abc123");
    });

    it("renders the outcome as a line of text", async () => {
        const cli = makeRestaurantCli({
            restaurant: makeStubRestaurant({ cancel: async () => "NotFound" }),
        });

        const message = await cli.cancel("abc123");

        expect(message).toBe("Reservation abc123 — NotFound");
    });
});

describe("makeRestaurantCli — update", () => {
    it("calls the Restaurant port with the id and parsed input", async () => {
        const update = vi.fn(async () => "Updated" as const);
        const cli = makeRestaurantCli({ restaurant: makeStubRestaurant({ update }) });

        await cli.update("abc123", { quantity: 6, date: "2026-06-09" });

        expect(update).toHaveBeenCalledWith("abc123", { quantity: 6, date: "2026-06-09" });
    });

    it("renders the outcome as a line of text", async () => {
        const cli = makeRestaurantCli({
            restaurant: makeStubRestaurant({ update: async () => "Updated" }),
        });

        const message = await cli.update("abc123", { quantity: 6, date: "2026-06-09" });

        expect(message).toBe("Reservation abc123 Updated — 6 seat(s) on 2026-06-09");
    });
});

describe("makeRestaurantCli — getReservations", () => {
    it("renders an empty list", async () => {
        const cli = makeRestaurantCli({
            restaurant: makeStubRestaurant({ getReservations: async () => [] }),
        });

        const message = await cli.getReservations();

        expect(message).toBe("No reservations");
    });

    it("renders a list of reservations", async () => {
        const cli = makeRestaurantCli({
            restaurant: makeStubRestaurant({
                getReservations: async () => [
                    { id: "abc123", quantity: 4, date: "2026-06-08" },
                    { id: "def456", quantity: 2, date: "2026-06-09" },
                ],
            }),
        });

        const message = await cli.getReservations();

        expect(message).toBe(
            "2 reservation(s):\n- abc123: 4 seat(s) on 2026-06-08\n- def456: 2 seat(s) on 2026-06-09",
        );
    });
});
