export function getDeliveryTestMessage() {
  return [
    "Meteora monitor — DELIVERY TEST",
    "No financial action is requested.",
    "If you can read this on your phone, Telegram delivery works."
  ].join("\n");
}

export async function fetchTelegramChatIds(
  {
    telegramApiBaseUrl = "https://api.telegram.org",
    telegramBotToken,
    requestTimeoutMs = 10_000
  },
  { fetchImpl = globalThis.fetch } = {}
) {
  if (!telegramBotToken) {
    throw new Error("TELEGRAM_BOT_TOKEN is required");
  }

  const url = new URL(
    `/bot${encodeURIComponent(telegramBotToken)}/getUpdates`,
    telegramApiBaseUrl
  );
  let response;
  try {
    response = await fetchImpl(url, {
      method: "GET",
      headers: { accept: "application/json" },
      signal: AbortSignal.timeout(requestTimeoutMs)
    });
  } catch {
    throw new Error("Telegram chat lookup failed because the network request failed");
  }

  let payload;
  try {
    payload = await response.json();
  } catch {
    throw new Error("Telegram returned invalid JSON during chat lookup");
  }
  if (!response.ok) {
    throw new Error(`Telegram returned HTTP ${response.status} during chat lookup`);
  }
  if (payload?.ok !== true || !Array.isArray(payload.result)) {
    throw new Error("Telegram rejected the chat lookup");
  }

  const chats = payload.result
    .map((update) => update.message?.chat ?? update.channel_post?.chat)
    .filter(Boolean);
  const uniqueChats = [
    ...new Map(chats.map((chat) => [String(chat.id), chat])).values()
  ];
  if (uniqueChats.length === 0) {
    throw new Error(
      "No Telegram chat was found. Open the bot, press Start, send it a message, and try again"
    );
  }

  return uniqueChats.map((chat) => ({
    id: String(chat.id),
    type: chat.type ?? "unknown",
    name:
      chat.title ??
      [chat.first_name, chat.last_name].filter(Boolean).join(" ") ??
      ""
  }));
}

export async function sendTelegramMessage(
  config,
  message,
  { fetchImpl = globalThis.fetch } = {}
) {
  if (!config.telegramBotToken) {
    throw new Error("TELEGRAM_BOT_TOKEN is required for delivery");
  }
  if (!config.telegramChatId) {
    throw new Error("TELEGRAM_CHAT_ID is required for delivery");
  }
  if (typeof fetchImpl !== "function") {
    throw new Error("A fetch implementation is required for Telegram delivery");
  }

  const url = new URL(
    `/bot${encodeURIComponent(config.telegramBotToken)}/sendMessage`,
    config.telegramApiBaseUrl
  );
  let response;
  try {
    response = await fetchImpl(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        chat_id: config.telegramChatId,
        text: message,
        disable_web_page_preview: true
      }),
      signal: AbortSignal.timeout(config.requestTimeoutMs)
    });
  } catch (error) {
    if (error?.name === "TimeoutError" || error?.name === "AbortError") {
      throw new Error("Telegram delivery timed out");
    }
    throw new Error("Telegram delivery failed because the network request failed");
  }

  let payload;
  try {
    payload = await response.json();
  } catch {
    throw new Error("Telegram returned invalid JSON");
  }

  if (!response.ok) {
    throw new Error(`Telegram returned HTTP ${response.status}`);
  }
  if (payload?.ok !== true) {
    const description =
      typeof payload?.description === "string"
        ? payload.description
        : "unknown rejection";
    throw new Error(`Telegram rejected the message: ${description}`);
  }

  return { messageId: payload.result?.message_id ?? null };
}
