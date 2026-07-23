const EXPECTED_POOL_ADDRESS = "C8Gr6AUuq9hEdSYJzoEpNcdjpojPZwqG5MtQbeouNNwg";
const BASE58_PUBLIC_KEY = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
const FORBIDDEN_SECRET_NAMES = [
  "PRIVATE_KEY",
  "SEED_PHRASE",
  "MNEMONIC",
  "WALLET_SECRET",
  "SOLANA_KEYPAIR"
];

function required(environment, name) {
  const value = environment[name];
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`${name} is required`);
  }
  return value.trim();
}

function numberValue(environment, name, fallback) {
  const raw = environment[name] ?? fallback;
  const value = Number(raw);
  if (!Number.isFinite(value)) throw new Error(`${name} must be a finite number`);
  return value;
}

function publicKey(environment, name) {
  const value = required(environment, name);
  if (!BASE58_PUBLIC_KEY.test(value)) {
    throw new Error(`${name} must be a base58 Solana public address`);
  }
  return value;
}

export function loadConfig(environment = process.env) {
  for (const secretName of FORBIDDEN_SECRET_NAMES) {
    if (environment[secretName]) {
      throw new Error(`${secretName} must not be present in the monitor environment`);
    }
  }

  const poolAddress = environment.POOL_ADDRESS?.trim() || EXPECTED_POOL_ADDRESS;
  if (poolAddress !== EXPECTED_POOL_ADDRESS) {
    throw new Error(`POOL_ADDRESS must remain ${EXPECTED_POOL_ADDRESS}`);
  }

  const config = {
    apiBaseUrl:
      environment.METEORA_API_BASE_URL?.trim() ||
      "https://dlmm.datapi.meteora.ag",
    poolAddress,
    walletAddress: publicKey(environment, "WALLET_ADDRESS"),
    positionAddress: publicKey(environment, "POSITION_ADDRESS"),
    positionCenterBinId: numberValue(environment, "POSITION_CENTER_BIN_ID"),
    initialDeployedSol: numberValue(environment, "INITIAL_DEPLOYED_SOL"),
    initialDeployedUsd: numberValue(environment, "INITIAL_DEPLOYED_USD"),
    externalCostsUsd: numberValue(environment, "EXTERNAL_COSTS_USD", 0),
    noiseLossPct: numberValue(environment, "NOISE_LOSS_PCT", -0.5),
    yellowAlphaPct: numberValue(environment, "YELLOW_ALPHA_PCT", -2),
    redLossPct: numberValue(environment, "RED_LOSS_PCT", -2),
    criticalLossPct: numberValue(environment, "CRITICAL_LOSS_PCT", -5),
    maxDataAgeMinutes: numberValue(environment, "MAX_DATA_AGE_MINUTES", 15),
    heartbeatHourUtc: numberValue(environment, "HEARTBEAT_HOUR_UTC", 15),
    requestTimeoutMs: numberValue(environment, "REQUEST_TIMEOUT_MS", 10_000),
    dangerReminderHours: numberValue(environment, "DANGER_REMINDER_HOURS", 6),
    statePath: environment.STATE_PATH?.trim() || "state/monitor.json",
    telegramApiBaseUrl:
      environment.TELEGRAM_API_BASE_URL?.trim() || "https://api.telegram.org",
    telegramBotToken: environment.TELEGRAM_BOT_TOKEN?.trim() || null,
    telegramChatId: environment.TELEGRAM_CHAT_ID?.trim() || null
  };

  if (config.initialDeployedSol <= 0 || config.initialDeployedUsd <= 0) {
    throw new Error("Initial deployed capital must be greater than zero");
  }
  if (config.initialDeployedSol > 19.88) {
    throw new Error(
      "INITIAL_DEPLOYED_SOL cannot exceed the 19.88 SOL-equivalent strategy ceiling"
    );
  }
  if (config.externalCostsUsd < 0) {
    throw new Error("EXTERNAL_COSTS_USD cannot be negative");
  }
  if (
    !(
      config.criticalLossPct < config.redLossPct &&
      config.redLossPct <= config.noiseLossPct
    )
  ) {
    throw new Error("Loss thresholds must progress from noise to red to critical");
  }
  if (
    !Number.isInteger(config.heartbeatHourUtc) ||
    config.heartbeatHourUtc < 0 ||
    config.heartbeatHourUtc > 23
  ) {
    throw new Error("HEARTBEAT_HOUR_UTC must be an integer from 0 to 23");
  }
  if (!Number.isInteger(config.positionCenterBinId)) {
    throw new Error("POSITION_CENTER_BIN_ID must be an integer");
  }
  if (
    config.maxDataAgeMinutes <= 0 ||
    config.requestTimeoutMs <= 0 ||
    config.dangerReminderHours <= 0
  ) {
    throw new Error("Data age, request timeout, and reminder interval must be positive");
  }

  return config;
}

export { EXPECTED_POOL_ADDRESS };
