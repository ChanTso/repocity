import assert from "node:assert/strict";
import test from "node:test";

import { add, multiply } from "../src/core/arithmetic.js";

test("arithmetic helpers", () => {
  assert.equal(add(2, 3), 5);
  assert.equal(multiply(4, 5), 20);
});
