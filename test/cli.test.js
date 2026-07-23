import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import test from "node:test";

import { getDeliveryTestMessage } from "../src/telegram-client.js";

test("fixture mode prints the same canonical report used for delivery", () => {
  const output = execFileSync(
    process.execPath,
    ["src/cli.js", "fixture", "test/fixtures/healthy.json", "--json"],
    { encoding: "utf8" }
  );
  const result = JSON.parse(output);

  assert.equal(result.report.status, "GREEN");
  assert.equal(result.report.netPnlUsd, 40);
  assert.match(result.message, /Meteora JUP-SOL — GREEN/);
});

test("delivery-test copy is clearly labelled and requests no financial action", () => {
  const message = getDeliveryTestMessage();

  assert.match(message, /DELIVERY TEST/);
  assert.match(message, /No financial action is requested/);
  assert.doesNotMatch(message, /rebalance|withdraw|swap/i);
});
