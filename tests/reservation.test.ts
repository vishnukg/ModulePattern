import test from "node:test";
import assert from "node:assert/strict";
import compose from "../src/compose.ts";

test.describe("reservations are accepted if we have enough seats at the table", () => {
  const { restaurant } = compose({ restaurantConfig: { tableSize: 12 } });
  [
    { quantity: 10, expected: "Accepted" },
    { quantity: 12, expected: "Accepted" },
    { quantity: 13, expected: "Rejected" },
  ].forEach(({ quantity, expected }) => {
    test(`reserve(${quantity}) returns ${expected}`, () => {
      const result = restaurant.reserve({ quantity, date: "12/12/12" });
      assert.equal(result, expected);
    });
  });
});
