const STATUS_ACTIONS = {
  GREEN: "No change. Continue monitoring.",
  YELLOW: "Inspect the report and prepare. Do not rebalance from one yellow alert.",
  RED: "Open Meteora on mobile, verify the live values, and prepare to reduce risk.",
  CRITICAL:
    "Stop adding capital. Inspect immediately and prioritize protecting the remaining capital.",
  DATA_FAILURE:
    "Do not trust this automated status. Inspect Meteora manually and restore monitoring."
};

function asFiniteNumber(value, label) {
  const number = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(number)) throw new Error(`${label} must be a finite number`);
  return number;
}

function asNonEmptyString(value, label) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`${label} must be a non-empty string`);
  }
  return value.trim();
}

function roundMoney(value) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function getMonth(isoTimestamp) {
  return isoTimestamp.slice(0, 7);
}

function formatMoney(value) {
  if (!Number.isFinite(value)) return "Unavailable";
  const sign = value < 0 ? "-" : "";
  return `${sign}$${Math.abs(value).toFixed(2)}`;
}

function formatSãoPauloTime(isoTimestamp) {
  if (Number.isNaN(new Date(isoTimestamp).getTime())) return "Unavailable";
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "short",
    timeStyle: "medium",
    timeZone: "America/Sao_Paulo",
    hour12: false
  }).format(new Date(isoTimestamp));
}

function decideDelivery(status, now, priorState, config) {
  const priorStatus = priorState?.lastStatus;
  const date = now.toISOString().slice(0, 10);

  if (status === "GREEN") {
    if (priorStatus && priorStatus !== "GREEN") {
      return { shouldDeliver: true, kind: "recovery" };
    }
    if (
      now.getUTCHours() === config.heartbeatHourUtc &&
      priorState?.lastHeartbeatDate !== date
    ) {
      return { shouldDeliver: true, kind: "heartbeat" };
    }
    return { shouldDeliver: false, kind: "suppressed" };
  }

  if (priorStatus !== status || !priorState?.lastDeliveredAt) {
    return { shouldDeliver: true, kind: "alert" };
  }

  const lastDeliveredAt = new Date(priorState.lastDeliveredAt);
  const reminderMilliseconds = config.dangerReminderHours * 60 * 60 * 1_000;
  if (
    Number.isNaN(lastDeliveredAt.getTime()) ||
    now.getTime() - lastDeliveredAt.getTime() >= reminderMilliseconds
  ) {
    return { shouldDeliver: true, kind: "reminder" };
  }

  return { shouldDeliver: false, kind: "rate-limited" };
}

function formatMessage(report, poolAddress) {
  const returnPct = Number.isFinite(report.netReturnPct)
    ? `${report.netReturnPct.toFixed(2)}%`
    : "Unavailable";
  const binSummary =
    Number.isFinite(report.activeBinId) &&
    Number.isFinite(report.nearestEdgeDistanceBins)
      ? `${report.activeBinId} · nearest edge: ${report.nearestEdgeDistanceBins} bins`
      : "Unavailable";
  const inventory =
    Number.isFinite(report.tokenXAmount) && Number.isFinite(report.tokenYAmount)
      ? `${report.tokenXAmount} ${report.tokenXSymbol} · ${report.tokenYAmount} ${report.tokenYSymbol}`
      : "Unavailable";
  const range =
    Number.isFinite(report.minPrice) &&
    Number.isFinite(report.activePrice) &&
    Number.isFinite(report.maxPrice)
      ? `${report.minPrice} < ${report.activePrice} < ${report.maxPrice}`
      : "Unavailable";

  return [
    `Meteora JUP-SOL — ${report.status}`,
    `Why: ${report.reasons.length > 0 ? report.reasons.join(" ") : "All safety checks passed."}`,
    `Net PnL: ${formatMoney(report.netPnlUsd)} (${returnPct})`,
    `This month: ${formatMoney(report.monthNetPnlUsd)} net PnL · ${formatMoney(report.monthFeeRevenueUsd)} fees`,
    `All-time fees: ${formatMoney(report.grossFeeRevenueUsd)}`,
    `vs holding SOL: ${formatMoney(report.alphaVsHodlUsd)}`,
    `Inventory: ${inventory}`,
    `Price range: ${range}`,
    `Active bin: ${binSummary}`,
    `Action: ${report.recommendedAction}`,
    `Open pool: https://app.meteora.ag/dlmm/${poolAddress}`,
    `Checked: ${report.checkedAt} UTC · ${formatSãoPauloTime(report.checkedAt)} São Paulo`
  ].join("\n");
}

function evaluateValidMonitorRun(input) {
  if (input.snapshotError) throw new Error(input.snapshotError);

  const now = new Date(input.now);
  const fetchedAt = new Date(input.snapshot.fetchedAt);
  const pool = input.snapshot.pool;
  const position = input.snapshot.position;
  const config = input.config;

  const grossFeeRevenueUsd = asFiniteNumber(
    position.allTimeFees.total.usd,
    "allTimeFees.total.usd"
  );
  const officialPnlUsd = asFiniteNumber(position.pnlUsd, "pnlUsd");
  const depositsUsd = asFiniteNumber(
    position.allTimeDeposits.total.usd,
    "allTimeDeposits.total.usd"
  );
  const withdrawalsUsd = asFiniteNumber(
    position.allTimeWithdrawals.total.usd,
    "allTimeWithdrawals.total.usd"
  );
  const balanceTokenXUsd = asFiniteNumber(
    position.unrealizedPnl.balanceTokenX.usd,
    "balanceTokenX.usd"
  );
  const balanceTokenYUsd = asFiniteNumber(
    position.unrealizedPnl.balanceTokenY.usd,
    "balanceTokenY.usd"
  );
  const tokenXAmount = asFiniteNumber(
    position.unrealizedPnl.balanceTokenX.amount,
    "balanceTokenX.amount"
  );
  const tokenYAmount = asFiniteNumber(
    position.unrealizedPnl.balanceTokenY.amount,
    "balanceTokenY.amount"
  );
  const tokenXSymbol = asNonEmptyString(pool.tokenXSymbol, "pool.tokenXSymbol");
  const tokenYSymbol = asNonEmptyString(pool.tokenYSymbol, "pool.tokenYSymbol");
  const activePrice = asFiniteNumber(position.poolActivePrice, "poolActivePrice");
  const minPrice = asFiniteNumber(position.minPrice, "minPrice");
  const maxPrice = asFiniteNumber(position.maxPrice, "maxPrice");
  const externalCostsUsd = asFiniteNumber(config.externalCostsUsd, "externalCostsUsd");
  const initialDeployedUsd = asFiniteNumber(
    config.initialDeployedUsd,
    "initialDeployedUsd"
  );
  const initialDeployedSol = asFiniteNumber(
    config.initialDeployedSol,
    "initialDeployedSol"
  );
  const solPriceUsd = asFiniteNumber(input.snapshot.solPriceUsd, "solPriceUsd");
  if (
    grossFeeRevenueUsd < 0 ||
    depositsUsd < 0 ||
    withdrawalsUsd < 0 ||
    balanceTokenXUsd < 0 ||
    balanceTokenYUsd < 0 ||
    tokenXAmount < 0 ||
    tokenYAmount < 0 ||
    activePrice <= 0 ||
    minPrice <= 0 ||
    maxPrice <= 0 ||
    solPriceUsd <= 0
  ) {
    throw new Error("Financial values that cannot be negative are invalid");
  }

  const independentlyCalculatedPnlUsd =
    balanceTokenXUsd +
    balanceTokenYUsd +
    withdrawalsUsd +
    grossFeeRevenueUsd -
    depositsUsd;
  const accountingToleranceUsd = Math.max(0.5, depositsUsd * 0.001);
  const accountingDifferenceUsd = Math.abs(
    officialPnlUsd - independentlyCalculatedPnlUsd
  );

  const netPnlUsd = officialPnlUsd - externalCostsUsd;
  const netReturnPct = (netPnlUsd / initialDeployedUsd) * 100;
  const hodlValueUsd = initialDeployedSol * solPriceUsd;
  const strategyValueUsd = initialDeployedUsd + netPnlUsd;
  const alphaVsHodlUsd = strategyValueUsd - hodlValueUsd;
  const alphaVsHodlPct = (alphaVsHodlUsd / initialDeployedUsd) * 100;
  const activeBinId = asFiniteNumber(position.poolActiveBinId, "poolActiveBinId");
  const lowerBinId = asFiniteNumber(position.lowerBinId, "lowerBinId");
  const upperBinId = asFiniteNumber(position.upperBinId, "upperBinId");
  const positionWidthBins = upperBinId - lowerBinId + 1;
  const centerDistanceBins = Math.abs(
    activeBinId - asFiniteNumber(config.positionCenterBinId, "positionCenterBinId")
  );
  const lowerEdgeDistanceBins = activeBinId - lowerBinId;
  const upperEdgeDistanceBins = upperBinId - activeBinId;
  const nearestEdgeDistanceBins = Math.min(
    lowerEdgeDistanceBins,
    upperEdgeDistanceBins
  );
  const derivedOutOfRange =
    activeBinId < lowerBinId || activeBinId > upperBinId;
  const dataAgeMinutes = (now.getTime() - fetchedAt.getTime()) / 60_000;

  const reasons = [];
  let status = "GREEN";

  if (
    position.positionAddress !== config.positionAddress ||
    position.isClosed !== false ||
    pool.address !== config.poolAddress ||
    Number(pool.binStep) !== 80 ||
    !(
      [tokenXSymbol, tokenYSymbol].includes("JUP") &&
      [tokenXSymbol, tokenYSymbol].includes("SOL")
    ) ||
    positionWidthBins !== 30 ||
    config.positionCenterBinId < lowerBinId ||
    config.positionCenterBinId > upperBinId ||
    dataAgeMinutes < 0 ||
    dataAgeMinutes > config.maxDataAgeMinutes ||
    accountingDifferenceUsd > accountingToleranceUsd
  ) {
    status = "DATA_FAILURE";
    if (position.positionAddress !== config.positionAddress) {
      reasons.push("The API returned a different position address.");
    }
    if (position.isClosed !== false) {
      reasons.push("The configured position is closed or has unknown status.");
    }
    if (pool.address !== config.poolAddress) {
      reasons.push("The API returned a different pool address.");
    }
    if (Number(pool.binStep) !== 80) {
      reasons.push("The pool is not the approved BS80 pool.");
    }
    if (
      !(
        [tokenXSymbol, tokenYSymbol].includes("JUP") &&
        [tokenXSymbol, tokenYSymbol].includes("SOL")
      )
    ) {
      reasons.push("The pool token pair is not JUP-SOL.");
    }
    if (positionWidthBins !== 30) {
      reasons.push("The configured position is not exactly 30 bins wide.");
    }
    if (
      config.positionCenterBinId < lowerBinId ||
      config.positionCenterBinId > upperBinId
    ) {
      reasons.push("The recorded entry center is outside the position bounds.");
    }
    if (dataAgeMinutes < 0 || dataAgeMinutes > config.maxDataAgeMinutes) {
      reasons.push("The upstream position data is stale.");
    }
    if (accountingDifferenceUsd > accountingToleranceUsd) {
      reasons.push("The independent PnL check does not match Meteora.");
    }
  } else if (
    position.isOutOfRange ||
    derivedOutOfRange ||
    netReturnPct <= config.criticalLossPct
  ) {
    status = "CRITICAL";
    if (position.isOutOfRange || derivedOutOfRange) {
      reasons.push("The position is out of range.");
    }
    if (netReturnPct <= config.criticalLossPct) {
      reasons.push("Net loss reached the critical threshold.");
    }
  } else if (
    centerDistanceBins >= 10 ||
    nearestEdgeDistanceBins <= 5 ||
    netReturnPct <= config.redLossPct
  ) {
    status = "RED";
    if (centerDistanceBins >= 10) {
      reasons.push("The active bin moved at least ten bins from the entry center.");
    }
    if (nearestEdgeDistanceBins <= 5) {
      reasons.push("Five or fewer bins remain to the nearest edge.");
    }
    if (netReturnPct <= config.redLossPct) {
      reasons.push("Net loss reached the red threshold.");
    }
  } else if (
    centerDistanceBins >= 7 ||
    netReturnPct <= config.noiseLossPct ||
    alphaVsHodlPct <= config.yellowAlphaPct
  ) {
    status = "YELLOW";
    if (centerDistanceBins >= 7) {
      reasons.push("The active bin moved at least seven bins from the entry center.");
    }
    if (netReturnPct <= config.noiseLossPct) {
      reasons.push("Net loss moved beyond the noise tolerance.");
    }
    if (alphaVsHodlPct <= config.yellowAlphaPct) {
      reasons.push("The strategy is materially underperforming holding SOL.");
    }
  }

  const currentMonth = getMonth(input.now);
  const currentDate = input.now.slice(0, 10);
  const priorState = input.priorState ?? {};
  if (
    priorState.positionAddress &&
    priorState.positionAddress !== config.positionAddress
  ) {
    throw new Error(
      "The position address changed without an explicit state rollover"
    );
  }
  const baselineMatchesMonth = priorState.month === currentMonth;
  const monthlyBaselineFeesUsd = baselineMatchesMonth
    ? asFiniteNumber(priorState.monthlyBaselineFeesUsd, "monthlyBaselineFeesUsd")
    : grossFeeRevenueUsd;
  const monthlyBaselineNetPnlUsd = baselineMatchesMonth
    ? asFiniteNumber(priorState.monthlyBaselineNetPnlUsd, "monthlyBaselineNetPnlUsd")
    : netPnlUsd;
  const monthFeeRevenueUsd = grossFeeRevenueUsd - monthlyBaselineFeesUsd;
  const monthNetPnlUsd = netPnlUsd - monthlyBaselineNetPnlUsd;
  const delivery = decideDelivery(status, now, priorState, config);

  const report = {
    status,
    reasons,
    grossFeeRevenueUsd: roundMoney(grossFeeRevenueUsd),
    monthFeeRevenueUsd: roundMoney(monthFeeRevenueUsd),
    netPnlUsd: roundMoney(netPnlUsd),
    monthNetPnlUsd: roundMoney(monthNetPnlUsd),
    netReturnPct: roundMoney(netReturnPct),
    hodlValueUsd: roundMoney(hodlValueUsd),
    alphaVsHodlUsd: roundMoney(alphaVsHodlUsd),
    alphaVsHodlPct: roundMoney(alphaVsHodlPct),
    solPriceUsd: roundMoney(solPriceUsd),
    positionValueUsd: roundMoney(balanceTokenXUsd + balanceTokenYUsd),
    tokenXValueUsd: roundMoney(balanceTokenXUsd),
    tokenYValueUsd: roundMoney(balanceTokenYUsd),
    tokenXSymbol,
    tokenYSymbol,
    tokenXAmount,
    tokenYAmount,
    activePrice,
    minPrice,
    maxPrice,
    activeBinId,
    lowerBinId,
    upperBinId,
    lowerEdgeDistanceBins,
    upperEdgeDistanceBins,
    nearestEdgeDistanceBins,
    centerDistanceBins,
    recommendedAction: STATUS_ACTIONS[status],
    checkedAt: now.toISOString()
  };
  const priorSnapshots = Array.isArray(priorState.dailySnapshots)
    ? priorState.dailySnapshots
    : [];
  const hasTodaySnapshot = priorSnapshots.some(
    (snapshot) => snapshot.date === currentDate
  );
  const dailySnapshots = hasTodaySnapshot
    ? priorSnapshots
    : [
        ...priorSnapshots,
        {
          date: currentDate,
          checkedAt: report.checkedAt,
          status,
          netPnlUsd: report.netPnlUsd,
          grossFeeRevenueUsd: report.grossFeeRevenueUsd,
          alphaVsHodlUsd: report.alphaVsHodlUsd,
          solPriceUsd: report.solPriceUsd
        }
      ].slice(-90);
  const nextState = {
    ...priorState,
    version: 1,
    positionAddress: config.positionAddress,
    month: currentMonth,
    monthlyBaselineFeesUsd,
    monthlyBaselineNetPnlUsd,
    dailySnapshots,
    lastStatus: status
  };
  if (delivery.shouldDeliver) {
    nextState.lastDeliveredAt = now.toISOString();
  }
  if (delivery.kind === "heartbeat") {
    nextState.lastHeartbeatDate = currentDate;
  }

  return {
    report,
    message: formatMessage(report, config.poolAddress),
    delivery,
    nextState
  };
}

export function evaluateMonitorRun(input) {
  try {
    return evaluateValidMonitorRun(input);
  } catch (error) {
    const checkedAt = Number.isNaN(new Date(input?.now).getTime())
      ? "Unknown"
      : new Date(input.now).toISOString();
    const report = {
      status: "DATA_FAILURE",
      reasons: [error instanceof Error ? error.message : String(error)],
      grossFeeRevenueUsd: null,
      monthFeeRevenueUsd: null,
      netPnlUsd: null,
      monthNetPnlUsd: null,
      netReturnPct: null,
      hodlValueUsd: null,
      alphaVsHodlUsd: null,
      alphaVsHodlPct: null,
      solPriceUsd: null,
      positionValueUsd: null,
      tokenXValueUsd: null,
      tokenYValueUsd: null,
      tokenXSymbol: null,
      tokenYSymbol: null,
      tokenXAmount: null,
      tokenYAmount: null,
      activePrice: null,
      minPrice: null,
      maxPrice: null,
      activeBinId: null,
      nearestEdgeDistanceBins: null,
      centerDistanceBins: null,
      recommendedAction: STATUS_ACTIONS.DATA_FAILURE,
      checkedAt
    };

    const now = new Date(input?.now);
    const config = {
      heartbeatHourUtc: input?.config?.heartbeatHourUtc ?? 15,
      dangerReminderHours: input?.config?.dangerReminderHours ?? 6
    };
    const delivery = Number.isNaN(now.getTime())
      ? { shouldDeliver: true, kind: "alert" }
      : decideDelivery(
          "DATA_FAILURE",
          now,
          input?.priorState ?? {},
          config
        );
    const nextState = {
      ...(input?.priorState ?? {}),
      lastStatus: "DATA_FAILURE"
    };
    if (delivery.shouldDeliver && !Number.isNaN(now.getTime())) {
      nextState.lastDeliveredAt = now.toISOString();
    }

    return {
      report,
      message: formatMessage(
        report,
        input?.config?.poolAddress ?? "unknown-pool"
      ),
      delivery,
      nextState
    };
  }
}
