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

function roundTokenAmount(value) {
  return Math.round((value + Number.EPSILON) * 1_000_000_000) / 1_000_000_000;
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
      now.getUTCHours() >= config.heartbeatHourUtc &&
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
    `Current position: ${formatMoney(report.positionValueUsd)} · unclaimed fees: ${formatMoney(report.unclaimedFeeValueUsd)}`,
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
  const priorState = input.priorState ?? {};
  if (
    priorState.positionAddress &&
    priorState.positionAddress !== config.positionAddress
  ) {
    throw new Error(
      "The position address changed without an explicit state rollover"
    );
  }

  const currentPositionGrossFeeRevenueUsd = asFiniteNumber(
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
  const unclaimedFeeTokenXUsd = asFiniteNumber(
    position.unrealizedPnl.unclaimedFeeTokenX.usd,
    "unclaimedFeeTokenX.usd"
  );
  const unclaimedFeeTokenYUsd = asFiniteNumber(
    position.unrealizedPnl.unclaimedFeeTokenY.usd,
    "unclaimedFeeTokenY.usd"
  );
  const unclaimedFeeTokenXAmount = asFiniteNumber(
    position.unrealizedPnl.unclaimedFeeTokenX.amount,
    "unclaimedFeeTokenX.amount"
  );
  const unclaimedFeeTokenYAmount = asFiniteNumber(
    position.unrealizedPnl.unclaimedFeeTokenY.amount,
    "unclaimedFeeTokenY.amount"
  );
  const tokenXSymbol = asNonEmptyString(pool.tokenXSymbol, "pool.tokenXSymbol");
  const tokenYSymbol = asNonEmptyString(pool.tokenYSymbol, "pool.tokenYSymbol");
  const activePrice = asFiniteNumber(position.poolActivePrice, "poolActivePrice");
  const poolCurrentPrice = asFiniteNumber(
    pool.currentPrice,
    "pool.currentPrice"
  );
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
  const carriedNetPnlUsd = asFiniteNumber(
    priorState.carriedNetPnlUsd ?? 0,
    "carriedNetPnlUsd"
  );
  const carriedGrossFeeRevenueUsd = asFiniteNumber(
    priorState.carriedGrossFeeRevenueUsd ?? 0,
    "carriedGrossFeeRevenueUsd"
  );
  if (
    currentPositionGrossFeeRevenueUsd < 0 ||
    carriedGrossFeeRevenueUsd < 0 ||
    depositsUsd < 0 ||
    withdrawalsUsd < 0 ||
    balanceTokenXUsd < 0 ||
    balanceTokenYUsd < 0 ||
    tokenXAmount < 0 ||
    tokenYAmount < 0 ||
    unclaimedFeeTokenXUsd < 0 ||
    unclaimedFeeTokenYUsd < 0 ||
    unclaimedFeeTokenXAmount < 0 ||
    unclaimedFeeTokenYAmount < 0 ||
    activePrice <= 0 ||
    poolCurrentPrice <= 0 ||
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
    currentPositionGrossFeeRevenueUsd -
    depositsUsd;
  const accountingToleranceUsd = Math.max(0.5, depositsUsd * 0.001);
  const accountingDifferenceUsd = Math.abs(
    officialPnlUsd - independentlyCalculatedPnlUsd
  );

  const currentPositionNetPnlUsd = officialPnlUsd - externalCostsUsd;
  const netPnlUsd = carriedNetPnlUsd + currentPositionNetPnlUsd;
  const grossFeeRevenueUsd =
    carriedGrossFeeRevenueUsd + currentPositionGrossFeeRevenueUsd;
  const netReturnPct = (netPnlUsd / initialDeployedUsd) * 100;
  const hodlValueUsd = initialDeployedSol * solPriceUsd;
  const strategyValueUsd = initialDeployedUsd + netPnlUsd;
  const alphaVsHodlUsd = strategyValueUsd - hodlValueUsd;
  const alphaVsHodlPct = (alphaVsHodlUsd / initialDeployedUsd) * 100;
  const activeBinId = asFiniteNumber(position.poolActiveBinId, "poolActiveBinId");
  const lowerBinId = asFiniteNumber(position.lowerBinId, "lowerBinId");
  const upperBinId = asFiniteNumber(position.upperBinId, "upperBinId");
  const positionWidthBins = upperBinId - lowerBinId + 1;
  const binIdsAreIntegers = [activeBinId, lowerBinId, upperBinId].every(
    Number.isInteger
  );
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
  const centerToLowerEdgeBins = config.positionCenterBinId - lowerBinId;
  const centerToUpperEdgeBins = upperBinId - config.positionCenterBinId;
  const centerIsValid =
    Math.abs(centerToLowerEdgeBins - centerToUpperEdgeBins) <= 1;
  const dataAgeMinutes = (now.getTime() - fetchedAt.getTime()) / 60_000;
  const crossEndpointPriceDifferencePct =
    (Math.abs(activePrice - poolCurrentPrice) / poolCurrentPrice) * 100;
  const redTriggers = {
    centerDistance: centerDistanceBins >= 10,
    edgeDistance: nearestEdgeDistanceBins <= 5,
    loss: netReturnPct <= config.redLossPct
  };
  const redTriggerCount = Object.values(redTriggers).filter(Boolean).length;

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
    !binIdsAreIntegers ||
    config.positionCenterBinId < lowerBinId ||
    config.positionCenterBinId > upperBinId ||
    !centerIsValid ||
    minPrice >= maxPrice ||
    crossEndpointPriceDifferencePct > 2 ||
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
    if (!binIdsAreIntegers) {
      reasons.push("Meteora returned a non-integer bin ID.");
    }
    if (
      config.positionCenterBinId < lowerBinId ||
      config.positionCenterBinId > upperBinId
    ) {
      reasons.push("The recorded entry center is outside the position bounds.");
    }
    if (!centerIsValid) {
      reasons.push("The recorded entry bin is not centered in the 30-bin range.");
    }
    if (minPrice >= maxPrice) {
      reasons.push("The position price bounds are invalid.");
    }
    if (crossEndpointPriceDifferencePct > 2) {
      reasons.push(
        "The position and pool endpoints disagree on the current price."
      );
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
    netReturnPct <= config.criticalLossPct ||
    redTriggerCount >= 2
  ) {
    status = "CRITICAL";
    if (position.isOutOfRange || derivedOutOfRange) {
      reasons.push("The position is out of range.");
    }
    if (netReturnPct <= config.criticalLossPct) {
      reasons.push("Net loss reached the critical threshold.");
    }
    if (redTriggerCount >= 2) {
      reasons.push("Multiple red safety conditions occurred together.");
      if (redTriggers.centerDistance) {
        reasons.push("The active bin moved at least ten bins from the entry center.");
      }
      if (redTriggers.edgeDistance) {
        reasons.push("Five or fewer bins remain to the nearest edge.");
      }
      if (redTriggers.loss) {
        reasons.push("Net loss reached the red threshold.");
      }
    }
  } else if (
    redTriggers.centerDistance ||
    redTriggers.edgeDistance ||
    redTriggers.loss
  ) {
    status = "RED";
    if (redTriggers.centerDistance) {
      reasons.push("The active bin moved at least ten bins from the entry center.");
    }
    if (redTriggers.edgeDistance) {
      reasons.push("Five or fewer bins remain to the nearest edge.");
    }
    if (redTriggers.loss) {
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
  const baselineMatchesMonth = priorState.month === currentMonth;
  const monthlyBaselineFeesUsd = baselineMatchesMonth
    ? asFiniteNumber(priorState.monthlyBaselineFeesUsd, "monthlyBaselineFeesUsd")
    : status === "DATA_FAILURE"
      ? null
      : grossFeeRevenueUsd;
  const monthlyBaselineNetPnlUsd = baselineMatchesMonth
    ? asFiniteNumber(priorState.monthlyBaselineNetPnlUsd, "monthlyBaselineNetPnlUsd")
    : status === "DATA_FAILURE"
      ? null
      : netPnlUsd;
  const monthFeeRevenueUsd = Number.isFinite(monthlyBaselineFeesUsd)
    ? grossFeeRevenueUsd - monthlyBaselineFeesUsd
    : null;
  const monthNetPnlUsd = Number.isFinite(monthlyBaselineNetPnlUsd)
    ? netPnlUsd - monthlyBaselineNetPnlUsd
    : null;
  const delivery = decideDelivery(status, now, priorState, config);
  const financialsAreTrusted = status !== "DATA_FAILURE";
  const withdrawableTokenXAmount =
    tokenXAmount + unclaimedFeeTokenXAmount;
  const withdrawableTokenYAmount =
    tokenYAmount + unclaimedFeeTokenYAmount;
  const unclaimedFeeValueUsd =
    unclaimedFeeTokenXUsd + unclaimedFeeTokenYUsd;
  const positionValueUsd =
    balanceTokenXUsd + balanceTokenYUsd + unclaimedFeeValueUsd;

  const report = {
    status,
    reasons,
    grossFeeRevenueUsd: financialsAreTrusted
      ? roundMoney(grossFeeRevenueUsd)
      : null,
    currentPositionGrossFeeRevenueUsd: financialsAreTrusted
      ? roundMoney(currentPositionGrossFeeRevenueUsd)
      : null,
    monthFeeRevenueUsd:
      financialsAreTrusted && Number.isFinite(monthFeeRevenueUsd)
      ? roundMoney(monthFeeRevenueUsd)
      : null,
    netPnlUsd: financialsAreTrusted ? roundMoney(netPnlUsd) : null,
    currentPositionNetPnlUsd: financialsAreTrusted
      ? roundMoney(currentPositionNetPnlUsd)
      : null,
    monthNetPnlUsd:
      financialsAreTrusted && Number.isFinite(monthNetPnlUsd)
      ? roundMoney(monthNetPnlUsd)
      : null,
    netReturnPct: financialsAreTrusted ? roundMoney(netReturnPct) : null,
    hodlValueUsd: financialsAreTrusted ? roundMoney(hodlValueUsd) : null,
    alphaVsHodlUsd: financialsAreTrusted ? roundMoney(alphaVsHodlUsd) : null,
    alphaVsHodlPct: financialsAreTrusted ? roundMoney(alphaVsHodlPct) : null,
    solPriceUsd: financialsAreTrusted ? roundMoney(solPriceUsd) : null,
    positionValueUsd: financialsAreTrusted ? roundMoney(positionValueUsd) : null,
    unclaimedFeeValueUsd: financialsAreTrusted
      ? roundMoney(unclaimedFeeValueUsd)
      : null,
    tokenXValueUsd: financialsAreTrusted ? roundMoney(balanceTokenXUsd) : null,
    tokenYValueUsd: financialsAreTrusted ? roundMoney(balanceTokenYUsd) : null,
    tokenXSymbol: financialsAreTrusted ? tokenXSymbol : null,
    tokenYSymbol: financialsAreTrusted ? tokenYSymbol : null,
    tokenXAmount: financialsAreTrusted
      ? roundTokenAmount(withdrawableTokenXAmount)
      : null,
    tokenYAmount: financialsAreTrusted
      ? roundTokenAmount(withdrawableTokenYAmount)
      : null,
    activePrice: financialsAreTrusted ? activePrice : null,
    poolCurrentPrice: financialsAreTrusted ? poolCurrentPrice : null,
    minPrice: financialsAreTrusted ? minPrice : null,
    maxPrice: financialsAreTrusted ? maxPrice : null,
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
  const nextState =
    status === "DATA_FAILURE"
      ? {
          ...priorState,
          lastStatus: status
        }
      : {
          ...priorState,
          version: 1,
          positionAddress: config.positionAddress,
          month: currentMonth,
          monthlyBaselineFeesUsd,
          monthlyBaselineNetPnlUsd,
          dailySnapshots,
          lastStatus: status,
          lastNetPnlUsd: report.netPnlUsd,
          lastGrossFeeRevenueUsd: report.grossFeeRevenueUsd
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
      currentPositionGrossFeeRevenueUsd: null,
      monthFeeRevenueUsd: null,
      netPnlUsd: null,
      currentPositionNetPnlUsd: null,
      monthNetPnlUsd: null,
      netReturnPct: null,
      hodlValueUsd: null,
      alphaVsHodlUsd: null,
      alphaVsHodlPct: null,
      solPriceUsd: null,
      positionValueUsd: null,
      unclaimedFeeValueUsd: null,
      tokenXValueUsd: null,
      tokenYValueUsd: null,
      tokenXSymbol: null,
      tokenYSymbol: null,
      tokenXAmount: null,
      tokenYAmount: null,
      activePrice: null,
      poolCurrentPrice: null,
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
