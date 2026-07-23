import assert from "node:assert/strict";
import test from "node:test";

import {
  fetchTelegramChatIds,
  sendTelegramMessage
} from "../src/telegram-client.js";

const config = {
  telegramApiBaseUrl: "https://api.telegram.org",
  telegramBotToken: "123456:top-secret-token",
  telegramChatId: "987654",
  requestTimeoutMs: 10_000
};

test("Telegram delivery posts the canonical message to the configured chat", async () => {
  let request;
  const fetchImpl = async (url, options) => {
    request = { url: String(url), options };
    return new Response(JSON.stringify({ ok: true, result: { message_id: 7 } }), {
      status: 200,
      headers: { "content-type": "application/json" }
    });
  };

  const result = await sendTelegramMessage(config, "canonical report", { fetchImpl });

  assert.equal(result.messageId, 7);
  assert.match(request.url, /\/bot123456%3Atop-secret-token\/sendMessage$/);
  assert.deepEqual(JSON.parse(request.options.body), {
    chat_id: "987654",
    text: "canonical report",
    disable_web_page_preview: true
  });
});

test("Telegram rejection fails without leaking the bot token", async () => {
  const fetchImpl = async () =>
    new Response(JSON.stringify({ ok: false, description: "Forbidden" }), {
      status: 200,
      headers: { "content-type": "application/json" }
    });

  await assert.rejects(
    sendTelegramMessage(config, "test", { fetchImpl }),
    (error) => {
      assert.match(error.message, /Telegram rejected the message: Forbidden/);
      assert.doesNotMatch(error.message, /top-secret-token/);
      return true;
    }
  );
});

test("Telegram malformed responses and missing credentials fail visibly", async () => {
  const fetchImpl = async () =>
    new Response("not-json", {
      status: 200,
      headers: { "content-type": "text/plain" }
    });

  await assert.rejects(
    sendTelegramMessage(config, "test", { fetchImpl }),
    /invalid JSON/
  );
  await assert.rejects(
    sendTelegramMessage({ ...config, telegramBotToken: null }, "test", {
      fetchImpl
    }),
    /TELEGRAM_BOT_TOKEN/
  );
});

test("Telegram timeout and network failure are actionable and never leak the token", async () => {
  const timeoutFetch = async () => {
    const error = new Error("request aborted for 123456:top-secret-token");
    error.name = "TimeoutError";
    throw error;
  };
  const networkFetch = async () => {
    throw new Error("DNS failed for 123456:top-secret-token");
  };

  await assert.rejects(
    sendTelegramMessage(config, "test", { fetchImpl: timeoutFetch }),
    (error) => {
      assert.match(error.message, /timed out/i);
      assert.doesNotMatch(error.message, /top-secret-token/);
      return true;
    }
  );
  await assert.rejects(
    sendTelegramMessage(config, "test", { fetchImpl: networkFetch }),
    (error) => {
      assert.match(error.message, /network request failed/i);
      assert.doesNotMatch(error.message, /top-secret-token/);
      return true;
    }
  );
});

test("Telegram chat lookup returns unique chat IDs after the owner messages the bot", async () => {
  const fetchImpl = async () =>
    new Response(
      JSON.stringify({
        ok: true,
        result: [
          {
            update_id: 1,
            message: {
              chat: { id: 987654, type: "private", first_name: "Gabe" }
            }
          },
          {
            update_id: 2,
            message: {
              chat: { id: 987654, type: "private", first_name: "Gabe" }
            }
          }
        ]
      }),
      { status: 200, headers: { "content-type": "application/json" } }
    );

  const chats = await fetchTelegramChatIds(config, { fetchImpl });

  assert.deepEqual(chats, [{ id: "987654", type: "private", name: "Gabe" }]);
});
