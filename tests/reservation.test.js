import compose from "../src/compose.js";

import test from "node:test";
import assert from "node:assert/strict";

test.describe("reservations are accepted if we have enough seats at the table", () => {
  const config = { tableSize: 12 };
  const { restaurant } = compose({ config });

  [
    { quantity: 10, expected: "Accepted" },
    { quantity: 12, expected: "Accepted" },
    { quantity: 13, expected: "Rejected" },
  ].forEach(({ quantity, expected }) => {
    test(`reserve(${quantity}) returns ${expected}`, () => {
      const result = restaurant.reserve({ quantity });
      assert.equal(result, expected);
    });
  });
});
