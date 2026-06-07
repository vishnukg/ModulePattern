import { describe, it, expect } from "vitest";
import { randomUUID } from "node:crypto";
import composeServerApp from "../src/server/compose.ts";
import makeInMemoryDb from "../src/restaurant/adapters/db/makeInMemoryDb.ts";
import makeSilentLogger from "./helpers/silentLogger.ts";
import makeFakeMetrics from "./helpers/fakeMetrics.ts";

const silent = () => makeSilentLogger();
const fake = () => makeFakeMetrics();
const db = () => makeInMemoryDb({ logger: makeSilentLogger(), generateId: randomUUID });

describe("reservations are accepted if we have enough seats at the table", () => {
    it("reserve(10) returns Accepted", async () => {
        const { restaurant } = composeServerApp({
            restaurantCfg: { tableSize: 12 },
            logger: silent(),
            metrics: fake(),
            db: db(),
        });
        expect(await restaurant.reserve({ quantity: 10, date: "12/12/12" })).toBe("Accepted");
    });

    it("reserve(12) returns Accepted", async () => {
        const { restaurant } = composeServerApp({
            restaurantCfg: { tableSize: 12 },
            logger: silent(),
            metrics: fake(),
            db: db(),
        });
        expect(await restaurant.reserve({ quantity: 12, date: "12/12/12" })).toBe("Accepted");
    });

    it("reserve(13) returns Rejected", async () => {
        const { restaurant } = composeServerApp({
            restaurantCfg: { tableSize: 12 },
            logger: silent(),
            metrics: fake(),
            db: db(),
        });
        expect(await restaurant.reserve({ quantity: 13, date: "12/12/12" })).toBe("Rejected");
    });
});

describe("metrics are recorded on each reservation attempt", () => {
    it("increments reservation.accepted on a successful reservation", async () => {
        const metrics = fake();
        const { restaurant } = composeServerApp({
            restaurantCfg: { tableSize: 12 },
            logger: silent(),
            metrics,
            db: db(),
        });

        await restaurant.reserve({ quantity: 10, date: "12/12/12" });

        expect(metrics.getCounter("reservation.accepted")).toBe(1);
        expect(metrics.getCounter("reservation.rejected")).toBe(0);
    });

    it("increments reservation.rejected when quantity exceeds table size", async () => {
        const metrics = fake();
        const { restaurant } = composeServerApp({
            restaurantCfg: { tableSize: 12 },
            logger: silent(),
            metrics,
            db: db(),
        });

        await restaurant.reserve({ quantity: 13, date: "12/12/12" });

        expect(metrics.getCounter("reservation.rejected")).toBe(1);
        expect(metrics.getCounter("reservation.accepted")).toBe(0);
    });

    it("records a timing for every attempt regardless of outcome", async () => {
        const metrics = fake();
        const { restaurant } = composeServerApp({
            restaurantCfg: { tableSize: 12 },
            logger: silent(),
            metrics,
            db: db(),
        });

        await restaurant.reserve({ quantity: 10, date: "12/12/12" });
        await restaurant.reserve({ quantity: 13, date: "12/12/12" });

        expect(metrics.getTimings("reservation.duration_ms")).toHaveLength(2);
    });

    it("getTimings returns empty array before any timing is recorded", () => {
        const metrics = fake();
        expect(metrics.getTimings("reservation.duration_ms")).toEqual([]);
    });

    it("counters accumulate across multiple calls", async () => {
        const metrics = fake();
        const { restaurant } = composeServerApp({
            restaurantCfg: { tableSize: 12 },
            logger: silent(),
            metrics,
            db: db(),
        });

        await restaurant.reserve({ quantity: 10, date: "12/12/12" });
        await restaurant.reserve({ quantity: 10, date: "12/12/12" });
        await restaurant.reserve({ quantity: 13, date: "12/12/12" });

        expect(metrics.getCounter("reservation.accepted")).toBe(2);
        expect(metrics.getCounter("reservation.rejected")).toBe(1);
    });
});
