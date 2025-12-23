import compose from "../src/compose.js";

import test from "node:test";
import assert from "node:assert/strict";

test("restaurant reserve returns all reservations after successfule reservervation", () => {
  const { restaurant } = compose();
  const result = restaurant.reserve({ quantity: 10 });
  assert.deepEqual(result, [{ quantity: 10, date: undefined }]);
});
