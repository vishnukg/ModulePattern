import compose from "../src/compose.js";

import test from "node:test";
import assert from "node:assert/strict";

test("test reservation returns quantity", () => {
  console.error("test");
  const { restaurant } = compose();
  const result = restaurant.reserve({ quantity: 10 });
  assert.equal(result, 10);
});
