import assert from "node:assert/strict";
import test from "node:test";

import { fetchMeteoraSnapshot } from "../src/meteora-client.js";

const config = {
  apiBaseUrl: "https://dlmm.datapi.meteora.ag",
  poolAddress: "C8Gr6AUuq9hEdSYJzoEpNcdjpojPZwqG5MtQbeouNNwg",
  walletAddress: "JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN",
  positionAddress: "So11111111111111111111111111111111111111112",
  requestTimeoutMs: 10_000
};

test("the live adapter selects the configured open position from Meteora", async () => {
  const requestedUrls = [];
  const fetchImpl = async (url) => {
    requestedUrls.push(String(url));
    if (new URL(url).pathname === `/pools/${config.poolAddress}`) {
      return new Response(
        JSON.stringify({
          address: config.poolAddress,
          name: "JUP-SOL",
          pool_config: { bin_step: 80 },
          token_x: { symbol: "JUP" },
          token_y: { symbol: "SOL" }
        }),
        { status: 200, headers: { "content-type": "application/json" } }
      );
    }
    return new Response(
      JSON.stringify({
        positions: [
          {
            positionAddress: config.positionAddress,
            isClosed: false,
            pnlUsd: "12",
            lowerBinId: 80,
            upperBinId: 109,
            poolActiveBinId: 95
          }
        ],
        solPrice: "75.25"
      }),
      { status: 200, headers: { "content-type": "application/json" } }
    );
  };

  const snapshot = await fetchMeteoraSnapshot(config, {
    fetchImpl,
    now: new Date("2026-07-23T15:00:00.000Z")
  });

  assert.equal(requestedUrls.length, 2);
  const requestedUrl = requestedUrls
    .map((url) => new URL(url))
    .find((url) => url.pathname.includes("/positions/"));
  assert.equal(
    requestedUrl.pathname,
    `/positions/${config.poolAddress}/pnl`
  );
  assert.equal(requestedUrl.searchParams.get("user"), config.walletAddress);
  assert.equal(requestedUrl.searchParams.get("status"), "open");
  assert.equal(snapshot.position.positionAddress, config.positionAddress);
  assert.equal(snapshot.pool.address, config.poolAddress);
  assert.equal(snapshot.pool.binStep, 80);
  assert.equal(snapshot.pool.tokenXSymbol, "JUP");
  assert.equal(snapshot.solPriceUsd, "75.25");
  assert.equal(snapshot.fetchedAt, "2026-07-23T15:00:00.000Z");
});

test("the live adapter rejects a response that does not contain the configured position", async () => {
  const fetchImpl = async (url) => {
    if (new URL(url).pathname.startsWith("/pools/")) {
      return new Response(
        JSON.stringify({
          address: config.poolAddress,
          name: "JUP-SOL",
          pool_config: { bin_step: 80 },
          token_x: { symbol: "JUP" },
          token_y: { symbol: "SOL" }
        }),
        { status: 200, headers: { "content-type": "application/json" } }
      );
    }
    return new Response(JSON.stringify({ positions: [], solPrice: "75.25" }), {
      status: 200,
      headers: { "content-type": "application/json" }
    });
  };

  await assert.rejects(
    fetchMeteoraSnapshot(config, { fetchImpl, now: new Date() }),
    /configured open position was not returned/i
  );
});
