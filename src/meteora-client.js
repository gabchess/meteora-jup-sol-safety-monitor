export async function fetchMeteoraSnapshot(
  config,
  { fetchImpl = globalThis.fetch, now = new Date() } = {}
) {
  if (typeof fetchImpl !== "function") throw new Error("A fetch implementation is required");

  const positionUrl = new URL(
    `/positions/${encodeURIComponent(config.poolAddress)}/pnl`,
    config.apiBaseUrl
  );
  positionUrl.searchParams.set("user", config.walletAddress);
  positionUrl.searchParams.set("status", "open");
  positionUrl.searchParams.set("page", "1");
  positionUrl.searchParams.set("page_size", "100");
  const poolUrl = new URL(
    `/pools/${encodeURIComponent(config.poolAddress)}`,
    config.apiBaseUrl
  );

  async function fetchJson(url, label) {
    const response = await fetchImpl(url, {
      method: "GET",
      headers: { accept: "application/json" },
      signal: AbortSignal.timeout(config.requestTimeoutMs)
    });
    if (!response.ok) {
      throw new Error(`Meteora ${label} request returned HTTP ${response.status}`);
    }
    try {
      return await response.json();
    } catch {
      throw new Error(`Meteora ${label} response was not valid JSON`);
    }
  }

  const [positionPayload, poolPayload] = await Promise.all([
    fetchJson(positionUrl, "position"),
    fetchJson(poolUrl, "pool")
  ]);
  if (!Array.isArray(positionPayload.positions)) {
    throw new Error("Meteora response is missing the positions array");
  }

  const matches = positionPayload.positions.filter(
    (position) =>
      position.positionAddress === config.positionAddress &&
      position.isClosed === false
  );
  if (matches.length !== 1) {
    throw new Error("The configured open position was not returned by Meteora");
  }

  return {
    fetchedAt: now.toISOString(),
    solPriceUsd: positionPayload.solPrice,
    pool: {
      address: poolPayload.address,
      name: poolPayload.name,
      binStep: poolPayload.pool_config?.bin_step,
      tokenXSymbol: poolPayload.token_x?.symbol,
      tokenYSymbol: poolPayload.token_y?.symbol
    },
    position: matches[0]
  };
}
