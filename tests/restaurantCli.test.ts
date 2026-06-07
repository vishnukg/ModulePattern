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
