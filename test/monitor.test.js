import assert from "node:assert/strict";
import test from "node:test";

import { evaluateMonitorRun } from "../src/monitor.js";

const baseInput = {
  now: "2026-07-23T15:00:00.000Z",
  config: {
    poolAddress: "C8Gr6AUuq9hEdSYJzoEpNcdjpojPZwqG5MtQbeouNNwg",
    positionAddress: "position-public-address",
    positionCenterBinId: 100,
    initialDeployedSol: 19.88,
    initialDeployedUsd: 1_500,
    externalCostsUsd: 5,
    noiseLossPct: -0.5,
    yellowAlphaPct: -2,
    redLossPct: -2,
    criticalLossPct: -5,
    maxDataAgeMinutes: 15,
    heartbeatHourUtc: 15,
    dangerReminderHours: 6
  },
  snapshot: {
    fetchedAt: "2026-07-23T14:58:00.000Z",
    solPriceUsd: 75,
    pool: {
      address: "C8Gr6AUuq9hEdSYJzoEpNcdjpojPZwqG5MtQbeouNNwg",
      name: "JUP-SOL",
      binStep: 80,
      currentPrice: 0.0095,
      tokenXSymbol: "JUP",
      tokenYSymbol: "SOL"
    },
    position: {
      positionAddress: "position-public-address",
      isClosed: false,
      lowerBinId: 85,
      upperBinId: 114,
      poolActiveBinId: 102,
      poolActivePrice: "0.0095",
      minPrice: "0.0085",
      maxPrice: "0.0114",
      isOutOfRange: false,
      pnlUsd: "45",
      pnlPctChange: "3",
      allTimeDeposits: { total: { usd: "1500" } },
      allTimeWithdrawals: { total: { usd: "0" } },
      allTimeFees: { total: { usd: "45" } },
      unrealizedPnl: {
        balanceTokenX: { amount: "1000", usd: "700" },
        balanceTokenY: { amount: "10.666666", usd: "790" },
        unclaimedFeeTokenX: { amount: "5", usd: "3.50" },
        unclaimedFeeTokenY: { amount: "0.086666", usd: "6.50" }
      }
    }
  },
  priorState: {
    month: "2026-07",
    monthlyBaselineFeesUsd: 20,
    monthlyBaselineNetPnlUsd: 10,
    lastStatus: "GREEN",
    lastDeliveredAt: null,
    positionAddress: "position-public-address"
  }
};

test("a healthy position reports revenue, profit, return, and HODL comparison separately", () => {
  const result = evaluateMonitorRun(baseInput);

  assert.deepEqual(
    {
      status: result.report.status,
      grossFeeRevenueUsd: result.report.grossFeeRevenueUsd,
      monthFeeRevenueUsd: result.report.monthFeeRevenueUsd,
      netPnlUsd: result.report.netPnlUsd,
      monthNetPnlUsd: result.report.monthNetPnlUsd,
      netReturnPct: result.report.netReturnPct,
      hodlValueUsd: result.report.hodlValueUsd,
      alphaVsHodlUsd: result.report.alphaVsHodlUsd,
      tokenXSymbol: result.report.tokenXSymbol,
      tokenXAmount: result.report.tokenXAmount,
      tokenYSymbol: result.report.tokenYSymbol,
      tokenYAmount: result.report.tokenYAmount,
      positionValueUsd: result.report.positionValueUsd,
      recommendedAction: result.report.recommendedAction,
      shouldDeliver: result.delivery.shouldDeliver
    },
    {
      status: "GREEN",
      grossFeeRevenueUsd: 45,
      monthFeeRevenueUsd: 25,
      netPnlUsd: 40,
      monthNetPnlUsd: 30,
      netReturnPct: 2.67,
      hodlValueUsd: 1_491,
      alphaVsHodlUsd: 49,
      tokenXSymbol: "JUP",
      tokenXAmount: 1005,
      tokenYSymbol: "SOL",
      tokenYAmount: 10.753332,
      positionValueUsd: 1500,
      recommendedAction: "No change. Continue monitoring.",
      shouldDeliver: true
    }
  );
});

test("unclaimed fees are included in the independent PnL check", () => {
  const input = structuredClone(baseInput);
  input.snapshot.position.pnlUsd = "-20.673300280617468";
  input.snapshot.position.allTimeDeposits.total.usd = "1399.287694968667";
  input.snapshot.position.allTimeFees.total.usd = "0";
  input.snapshot.position.unrealizedPnl.balanceTokenX.usd =
    "551.3583551884253";
  input.snapshot.position.unrealizedPnl.balanceTokenY.usd = "825.660268596808";
  input.snapshot.position.unrealizedPnl.unclaimedFeeTokenX.usd =
    "0.6880233327568398";
  input.snapshot.position.unrealizedPnl.unclaimedFeeTokenY.usd =
    "0.9077475700595008";

  const result = evaluateMonitorRun(input);

  assert.equal(result.report.status, "YELLOW");
  assert.equal(result.report.netPnlUsd, -25.67);
  assert.equal(result.report.unclaimedFeeValueUsd, 1.6);
  assert.doesNotMatch(result.report.reasons.join(" "), /independent PnL/i);
});

test("positive fees never hide a negative net result", () => {
  const input = structuredClone(baseInput);
  input.snapshot.position.pnlUsd = "-20";
  input.snapshot.position.allTimeFees.total.usd = "60";
  input.snapshot.position.unrealizedPnl.balanceTokenX.usd = "650";
  input.snapshot.position.unrealizedPnl.balanceTokenY.usd = "760";

  const result = evaluateMonitorRun(input);

  assert.equal(result.report.status, "YELLOW");
  assert.equal(result.report.grossFeeRevenueUsd, 60);
  assert.equal(result.report.netPnlUsd, -25);
  assert.match(result.message, /Net PnL: -\$25\.00/);
  assert.doesNotMatch(result.message, /profit/i);
});

test("all-time fees are reported once and never added on top of PnL", () => {
  const input = structuredClone(baseInput);
  input.snapshot.position.pnlUsd = "20";
  input.snapshot.position.allTimeFees.total.usd = "60";
  input.snapshot.position.unrealizedPnl.balanceTokenX.usd = "650";
  input.snapshot.position.unrealizedPnl.balanceTokenY.usd = "800";

  const result = evaluateMonitorRun(input);

  assert.equal(result.report.grossFeeRevenueUsd, 60);
  assert.equal(result.report.netPnlUsd, 15);
  assert.equal(result.report.positionValueUsd, 1460);
  assert.equal(result.report.unclaimedFeeValueUsd, 10);
  assert.notEqual(result.report.netPnlUsd, 75);
});

test("noise, red loss, and critical loss thresholds are distinct", () => {
  const noise = structuredClone(baseInput);
  noise.snapshot.position.pnlUsd = "-1";
  noise.snapshot.position.unrealizedPnl.balanceTokenY.usd = "744";
  assert.equal(evaluateMonitorRun(noise).report.status, "GREEN");

  const red = structuredClone(baseInput);
  red.snapshot.position.pnlUsd = "-30";
  red.snapshot.position.unrealizedPnl.balanceTokenY.usd = "715";
  assert.equal(evaluateMonitorRun(red).report.status, "RED");

  const critical = structuredClone(baseInput);
  critical.snapshot.position.pnlUsd = "-80";
  critical.snapshot.position.unrealizedPnl.balanceTokenY.usd = "665";
  assert.equal(evaluateMonitorRun(critical).report.status, "CRITICAL");
});

test("malformed financial data fails safe instead of crashing", () => {
  const input = structuredClone(baseInput);
  input.snapshot.position.pnlUsd = "not-a-number";

  const result = evaluateMonitorRun(input);

  assert.equal(result.report.status, "DATA_FAILURE");
  assert.equal(result.report.netPnlUsd, null);
  assert.match(result.report.reasons[0], /pnlUsd must be a finite number/);
  assert.match(result.message, /Do not trust this automated status/);
  assert.equal(result.delivery.shouldDeliver, true);
});

test("an out-of-range position is critical and explains why", () => {
  const input = structuredClone(baseInput);
  input.snapshot.position.poolActiveBinId = 115;
  input.snapshot.position.isOutOfRange = true;

  const result = evaluateMonitorRun(input);

  assert.equal(result.report.status, "CRITICAL");
  assert.match(result.report.reasons.join(" "), /out of range/i);
  assert.match(result.report.recommendedAction, /Stop adding capital/);
});

test("single yellow and red bin-distance gates remain distinct", () => {
  const yellow = structuredClone(baseInput);
  yellow.snapshot.position.poolActiveBinId = 107;
  const yellowResult = evaluateMonitorRun(yellow);
  assert.equal(yellowResult.report.status, "YELLOW");
  assert.match(yellowResult.report.reasons.join(" "), /seven bins/i);

  const red = structuredClone(baseInput);
  red.snapshot.position.poolActiveBinId = 109;
  const redResult = evaluateMonitorRun(red);
  assert.equal(redResult.report.status, "RED");
  assert.match(redResult.report.reasons.join(" "), /nearest edge/i);
});

test("positive USD PnL still warns when holding SOL did materially better", () => {
  const input = structuredClone(baseInput);
  input.snapshot.solPriceUsd = 85;

  const result = evaluateMonitorRun(input);

  assert.equal(result.report.netPnlUsd, 40);
  assert.equal(result.report.alphaVsHodlUsd, -149.8);
  assert.equal(result.report.status, "YELLOW");
  assert.match(result.report.reasons.join(" "), /holding SOL/i);
});

test("an unexpected position width fails safe", () => {
  const input = structuredClone(baseInput);
  input.snapshot.position.upperBinId = 113;

  const result = evaluateMonitorRun(input);

  assert.equal(result.report.status, "DATA_FAILURE");
  assert.match(result.report.reasons.join(" "), /30 bins/i);
});

test("an off-center recorded entry bin fails safe", () => {
  const input = structuredClone(baseInput);
  input.config.positionCenterBinId = 86;

  const result = evaluateMonitorRun(input);

  assert.equal(result.report.status, "DATA_FAILURE");
  assert.match(result.report.reasons.join(" "), /not centered/i);
});

test("a mismatched pool or closed position fails safe", () => {
  const wrongPool = structuredClone(baseInput);
  wrongPool.snapshot.pool.binStep = 100;
  const wrongPoolResult = evaluateMonitorRun(wrongPool);

  assert.equal(wrongPoolResult.report.status, "DATA_FAILURE");
  assert.match(wrongPoolResult.report.reasons.join(" "), /BS80/i);

  const closed = structuredClone(baseInput);
  closed.snapshot.position.isClosed = true;
  const closedResult = evaluateMonitorRun(closed);

  assert.equal(closedResult.report.status, "DATA_FAILURE");
  assert.match(closedResult.report.reasons.join(" "), /closed/i);
});

test("cross-endpoint price disagreement fails safe", () => {
  const input = structuredClone(baseInput);
  input.snapshot.pool.currentPrice = 0.02;

  const result = evaluateMonitorRun(input);

  assert.equal(result.report.status, "DATA_FAILURE");
  assert.match(result.report.reasons.join(" "), /disagree.*current price/i);
});

test("stale data and accounting mismatches override otherwise healthy results", () => {
  const stale = structuredClone(baseInput);
  stale.snapshot.fetchedAt = "2026-07-23T14:00:00.000Z";
  const staleResult = evaluateMonitorRun(stale);

  assert.equal(staleResult.report.status, "DATA_FAILURE");
  assert.equal(staleResult.report.netPnlUsd, null);
  assert.equal(staleResult.report.grossFeeRevenueUsd, null);
  assert.match(staleResult.report.reasons.join(" "), /stale/i);

  const mismatch = structuredClone(baseInput);
  mismatch.snapshot.position.unrealizedPnl.balanceTokenX.usd = "500";
  const mismatchResult = evaluateMonitorRun(mismatch);

  assert.equal(mismatchResult.report.status, "DATA_FAILURE");
  assert.match(mismatchResult.report.reasons.join(" "), /independent PnL/i);

  stale.priorState = null;
  const firstRunFailure = evaluateMonitorRun(stale);
  assert.equal(firstRunFailure.nextState.month, undefined);
  assert.equal(firstRunFailure.nextState.monthlyBaselineFeesUsd, undefined);
  assert.equal(firstRunFailure.nextState.dailySnapshots, undefined);
});

test("green checks are suppressed except for one daily heartbeat", () => {
  const outsideHeartbeat = structuredClone(baseInput);
  outsideHeartbeat.now = "2026-07-23T14:00:00.000Z";
  outsideHeartbeat.snapshot.fetchedAt = "2026-07-23T13:58:00.000Z";
  outsideHeartbeat.priorState.lastHeartbeatDate = "2026-07-22";

  assert.equal(evaluateMonitorRun(outsideHeartbeat).delivery.shouldDeliver, false);

  const heartbeat = structuredClone(baseInput);
  heartbeat.priorState.lastHeartbeatDate = "2026-07-22";
  const heartbeatResult = evaluateMonitorRun(heartbeat);

  assert.equal(heartbeatResult.delivery.shouldDeliver, true);
  assert.equal(heartbeatResult.delivery.kind, "heartbeat");
  assert.equal(heartbeatResult.nextState.lastHeartbeatDate, "2026-07-23");

  heartbeat.priorState.lastHeartbeatDate = "2026-07-23";
  assert.equal(evaluateMonitorRun(heartbeat).delivery.shouldDeliver, false);

  const catchUp = structuredClone(baseInput);
  catchUp.now = "2026-07-23T16:00:00.000Z";
  catchUp.snapshot.fetchedAt = "2026-07-23T15:58:00.000Z";
  catchUp.priorState.lastHeartbeatDate = "2026-07-22";
  assert.equal(evaluateMonitorRun(catchUp).delivery.kind, "heartbeat");
});

test("danger alerts are rate-limited, reminded, and followed by recovery", () => {
  const danger = structuredClone(baseInput);
  danger.now = "2026-07-23T16:00:00.000Z";
  danger.snapshot.fetchedAt = "2026-07-23T15:58:00.000Z";
  danger.snapshot.position.poolActiveBinId = 110;
  danger.priorState.lastStatus = "GREEN";
  danger.priorState.lastDeliveredAt = "2026-07-23T15:00:00.000Z";

  const firstAlert = evaluateMonitorRun(danger);
  assert.equal(firstAlert.report.status, "CRITICAL");
  assert.equal(firstAlert.delivery.kind, "alert");

  danger.priorState.lastStatus = "CRITICAL";
  assert.equal(evaluateMonitorRun(danger).delivery.shouldDeliver, false);

  danger.now = "2026-07-23T22:01:00.000Z";
  danger.snapshot.fetchedAt = "2026-07-23T22:00:00.000Z";
  const reminder = evaluateMonitorRun(danger);
  assert.equal(reminder.delivery.shouldDeliver, true);
  assert.equal(reminder.delivery.kind, "reminder");

  const recovered = structuredClone(baseInput);
  recovered.now = "2026-07-23T16:00:00.000Z";
  recovered.snapshot.fetchedAt = "2026-07-23T15:58:00.000Z";
  recovered.priorState.lastStatus = "RED";
  recovered.priorState.lastDeliveredAt = "2026-07-23T15:00:00.000Z";
  const recovery = evaluateMonitorRun(recovered);

  assert.equal(recovery.report.status, "GREEN");
  assert.equal(recovery.delivery.shouldDeliver, true);
  assert.equal(recovery.delivery.kind, "recovery");
});

test("two simultaneous red range conditions escalate to critical", () => {
  const input = structuredClone(baseInput);
  input.snapshot.position.poolActiveBinId = 110;

  const result = evaluateMonitorRun(input);

  assert.equal(result.report.status, "CRITICAL");
  assert.match(result.report.reasons.join(" "), /multiple red/i);
});

test("rollover carry keeps lifetime profit and fee totals continuous", () => {
  const input = structuredClone(baseInput);
  input.priorState.carriedNetPnlUsd = 100;
  input.priorState.carriedGrossFeeRevenueUsd = 50;

  const result = evaluateMonitorRun(input);

  assert.equal(result.report.currentPositionNetPnlUsd, 40);
  assert.equal(result.report.netPnlUsd, 140);
  assert.equal(result.report.grossFeeRevenueUsd, 95);
  assert.equal(result.report.alphaVsHodlUsd, 149);
  assert.equal(result.nextState.lastNetPnlUsd, 140);
  assert.equal(result.nextState.lastGrossFeeRevenueUsd, 95);
});

test("a UTC month boundary starts a new zero baseline", () => {
  const input = structuredClone(baseInput);
  input.now = "2026-08-01T15:00:00.000Z";
  input.snapshot.fetchedAt = "2026-08-01T14:58:00.000Z";

  const result = evaluateMonitorRun(input);

  assert.equal(result.report.monthFeeRevenueUsd, 0);
  assert.equal(result.report.monthNetPnlUsd, 0);
  assert.equal(result.nextState.month, "2026-08");
  assert.equal(result.nextState.monthlyBaselineFeesUsd, 45);
  assert.equal(result.nextState.monthlyBaselineNetPnlUsd, 40);
});
