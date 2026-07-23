import assert from "node:assert/strict";
import test from "node:test";

import { loadConfig } from "../src/config.js";

const validEnvironment = {
  WALLET_ADDRESS: "JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN",
  POSITION_ADDRESS: "So11111111111111111111111111111111111111112",
  POSITION_CENTER_BIN_ID: "100",
  INITIAL_DEPLOYED_SOL: "19.88",
  INITIAL_DEPLOYED_USD: "1500"
};

test("configuration accepts public identifiers and applies conservative defaults", () => {
  const config = loadConfig(validEnvironment);

  assert.equal(
    config.poolAddress,
    "C8Gr6AUuq9hEdSYJzoEpNcdjpojPZwqG5MtQbeouNNwg"
  );
  assert.equal(config.initialDeployedSol, 19.88);
  assert.equal(config.externalCostsUsd, 0);
  assert.equal(config.noiseLossPct, -0.5);
  assert.equal(config.yellowAlphaPct, -2);
  assert.equal(config.redLossPct, -2);
  assert.equal(config.criticalLossPct, -5);
  assert.equal(config.statePath, "state/monitor.json");
});

test("configuration refuses wallet secrets even though the monitor never uses them", () => {
  assert.throws(
    () => loadConfig({ ...validEnvironment, PRIVATE_KEY: "do-not-store-this" }),
    /PRIVATE_KEY must not be present/
  );
});

test("configuration enforces the 19.88 SOL-equivalent capital ceiling", () => {
  assert.throws(
    () =>
      loadConfig({
        ...validEnvironment,
        INITIAL_DEPLOYED_SOL: "20.38"
      }),
    /19\.88 SOL-equivalent strategy ceiling/
  );
});

test("configuration requires an explicit public position address", () => {
  assert.throws(
    () => loadConfig({ ...validEnvironment, POSITION_ADDRESS: "" }),
    /POSITION_ADDRESS is required/
  );
});
