import { describe, it, expect } from "vitest";
import compose from "../src/compose.ts";

describe("reservations are accepted if we have enough seats at the table", () => {
  const { restaurant } = compose({ restaurantCfg: { tableSize: 12 } });

  it("reserve(10) returns Accepted", () => {
    expect(restaurant.reserve({ quantity: 10, date: "12/12/12" })).toBe("Accepted");
  });

  it("reserve(12) returns Accepted", () => {
    expect(restaurant.reserve({ quantity: 12, date: "12/12/12" })).toBe("Accepted");
  });

  it("reserve(13) returns Rejected", () => {
    expect(restaurant.reserve({ quantity: 13, date: "12/12/12" })).toBe("Rejected");
  });
});
