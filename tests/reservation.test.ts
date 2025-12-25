import { describe, it, expect } from "vitest";
import compose from "../src/compose.ts";

describe("reservations are accepted if we have enough seats at the table", () => {
  const { restaurant } = compose({ restaurantCfg: { tableSize: 12 } });
  [
    { quantity: 10, expected: "Accepted" },
    { quantity: 12, expected: "Accepted" },
    { quantity: 13, expected: "Rejected" },
  ].forEach(({ quantity, expected }) => {
    it(`reserve(${quantity}) returns ${expected}`, () => {
      const result = restaurant.reserve({ quantity, date: "12/12/12" });
      expect(result).toBe(expected);
    });
  });
});
