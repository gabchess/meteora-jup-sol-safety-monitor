#!/usr/bin/env node

import { readFile } from "node:fs/promises";

import { loadConfig } from "./config.js";
import { fetchMeteoraSnapshot } from "./meteora-client.js";
import { evaluateMonitorRun } from "./monitor.js";
import { loadMonitorState, saveMonitorState } from "./state-store.js";
import {
  fetchTelegramChatIds,
  getDeliveryTestMessage,
  sendTelegramMessage
} from "./telegram-client.js";

async function runFixture(args) {
  const fixturePath = args[0];
  if (!fixturePath) throw new Error("Usage: npm run report -- fixture <path> [--json]");

  const input = JSON.parse(await readFile(fixturePath, "utf8"));
  const result = evaluateMonitorRun(input);
  const jsonOutput = args.includes("--json");

  process.stdout.write(jsonOutput ? `${JSON.stringify(result, null, 2)}\n` : `${result.message}\n`);
}

async function evaluateLiveData(
  config,
  { stateRequired = false, stateMustBeEmpty = false } = {}
) {
  let priorState;
  let stateError;
  try {
    priorState = await loadMonitorState(config.statePath, {
      required: stateRequired
    });
    if (stateMustBeEmpty && priorState !== null) {
      throw new Error(
        "Monitor state already exists; initialization cannot overwrite financial history"
      );
    }
  } catch (error) {
    stateError = error instanceof Error ? error.message : String(error);
  }
  const now = new Date();
  let snapshot;
  let snapshotError;

  if (!stateError) {
    try {
      snapshot = await fetchMeteoraSnapshot(config, { now });
    } catch (error) {
      snapshotError = error instanceof Error ? error.message : String(error);
    }
  }

  return {
    now,
    stateError,
    result: evaluateMonitorRun({
      now: now.toISOString(),
      config,
      snapshot,
      snapshotError: stateError || snapshotError,
      priorState
    })
  };
}

async function runDryRun(args) {
  const config = loadConfig();
  const { result } = await evaluateLiveData(config);
  const jsonOutput = args.includes("--json");
  process.stdout.write(jsonOutput ? `${JSON.stringify(result, null, 2)}\n` : `${result.message}\n`);

  if (result.report.status === "DATA_FAILURE") process.exitCode = 2;
}

async function runDeliveryTest() {
  const config = {
    telegramApiBaseUrl:
      process.env.TELEGRAM_API_BASE_URL?.trim() || "https://api.telegram.org",
    telegramBotToken: process.env.TELEGRAM_BOT_TOKEN?.trim() || null,
    telegramChatId: process.env.TELEGRAM_CHAT_ID?.trim() || null,
    requestTimeoutMs: Number(process.env.REQUEST_TIMEOUT_MS || 10_000)
  };
  const delivery = await sendTelegramMessage(config, getDeliveryTestMessage());
  process.stdout.write(
    `Telegram delivery test passed${delivery.messageId ? ` (message ${delivery.messageId})` : ""}.\n`
  );
}

async function runTelegramChatId() {
  const chats = await fetchTelegramChatIds({
    telegramApiBaseUrl:
      process.env.TELEGRAM_API_BASE_URL?.trim() || "https://api.telegram.org",
    telegramBotToken: process.env.TELEGRAM_BOT_TOKEN?.trim(),
    requestTimeoutMs: Number(process.env.REQUEST_TIMEOUT_MS || 10_000)
  });
  for (const chat of chats) {
    process.stdout.write(
      `Chat ID: ${chat.id} · type: ${chat.type}${chat.name ? ` · name: ${chat.name}` : ""}\n`
    );
  }
}

async function runLive({ initialize = false } = {}) {
  const config = loadConfig();
  if (initialize && process.env.INITIALIZE_CONFIRMED !== "yes") {
    throw new Error(
      "Set INITIALIZE_CONFIRMED=yes only after reconciling the live dry run with Meteora"
    );
  }
  const { now, result, stateError } = await evaluateLiveData(config, {
    stateRequired: !initialize,
    stateMustBeEmpty: initialize
  });
  process.stdout.write(`${result.message}\n`);

  const shouldDeliver = initialize || result.delivery.shouldDeliver;
  if (shouldDeliver) {
    await sendTelegramMessage(config, result.message);
    result.nextState.lastDeliveredAt = now.toISOString();
  }
  if (
    !stateError &&
    !(initialize && result.report.status === "DATA_FAILURE")
  ) {
    await saveMonitorState(config.statePath, result.nextState);
  }

  if (result.report.status === "DATA_FAILURE") process.exitCode = 2;
}

async function runRollover() {
  const config = loadConfig();
  if (process.env.ROLLOVER_CONFIRMED !== "yes") {
    throw new Error(
      "Set ROLLOVER_CONFIRMED=yes only after manually closing the old position and recording the new public position address"
    );
  }

  const priorState = await loadMonitorState(config.statePath);
  if (!priorState?.positionAddress) {
    throw new Error("No prior position state exists to roll over");
  }
  if (priorState.positionAddress === config.positionAddress) {
    throw new Error("POSITION_ADDRESS is still the old position; nothing to roll over");
  }
  const carriedNetPnlUsd = Number(priorState.lastNetPnlUsd);
  const carriedGrossFeeRevenueUsd = Number(
    priorState.lastGrossFeeRevenueUsd
  );
  if (
    !Number.isFinite(carriedNetPnlUsd) ||
    !Number.isFinite(carriedGrossFeeRevenueUsd)
  ) {
    throw new Error(
      "The old position has no final PnL snapshot. Run the monitor and record the final report before rollover"
    );
  }

  const rolledOverAt = new Date().toISOString();
  const nextState = {
    version: 1,
    positionAddress: config.positionAddress,
    rollovers: [
      ...(Array.isArray(priorState.rollovers) ? priorState.rollovers : []),
      {
        fromPositionAddress: priorState.positionAddress,
        toPositionAddress: config.positionAddress,
        rolledOverAt,
        finalMonth: priorState.month ?? null,
        finalMonthlyBaselineFeesUsd:
          priorState.monthlyBaselineFeesUsd ?? null,
        finalMonthlyBaselineNetPnlUsd:
          priorState.monthlyBaselineNetPnlUsd ?? null,
        finalNetPnlUsd: carriedNetPnlUsd,
        finalGrossFeeRevenueUsd: carriedGrossFeeRevenueUsd
      }
    ],
    carriedNetPnlUsd,
    carriedGrossFeeRevenueUsd,
    month: priorState.month,
    monthlyBaselineFeesUsd: priorState.monthlyBaselineFeesUsd,
    monthlyBaselineNetPnlUsd: priorState.monthlyBaselineNetPnlUsd,
    dailySnapshots: Array.isArray(priorState.dailySnapshots)
      ? priorState.dailySnapshots
      : [],
    lastStatus: null,
    rolledOverAt
  };

  await saveMonitorState(config.statePath, nextState);
  process.stdout.write(
    "Monitor state rolled over to the new public position address. No wallet transaction was created or signed.\n"
  );
}

async function main() {
  const [command, ...args] = process.argv.slice(2);

  if (command === "fixture") {
    await runFixture(args);
    return;
  }
  if (command === "dry-run") {
    await runDryRun(args);
    return;
  }
  if (command === "delivery-test") {
    await runDeliveryTest();
    return;
  }
  if (command === "telegram-chat-id") {
    await runTelegramChatId();
    return;
  }
  if (command === "run") {
    await runLive();
    return;
  }
  if (command === "initialize") {
    await runLive({ initialize: true });
    return;
  }
  if (command === "rollover") {
    await runRollover();
    return;
  }

  throw new Error(
    "Usage: npm run report -- <fixture|dry-run|telegram-chat-id|delivery-test|initialize|run|rollover> [options]"
  );
}

main().catch((error) => {
  process.stderr.write(`Monitor failed: ${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
