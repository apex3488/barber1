import type { FastifyPluginAsync } from "fastify";
import type { Update } from "grammy/types";
import { getBot, getBotUsername } from "../bot/instance.js";
import { registerBotHandlers } from "../bot/handlers.js";

let handlersReady = false;

function ensureHandlers() {
  const bot = getBot();
  if (!bot) return null;
  if (!handlersReady) {
    registerBotHandlers(bot);
    handlersReady = true;
  }
  return bot;
}

export const telegramRoutes: FastifyPluginAsync = async (app) => {
  app.get("/api/v1/telegram/bot", async () => {
    const username = await getBotUsername();
    return {
      data: {
        username,
        deepLinkBase: username ? `https://t.me/${username}` : null,
      },
    };
  });

  app.post("/telegram/webhook", async (request, reply) => {
    const bot = ensureHandlers();
    if (!bot) {
      return reply.status(503).send({
        code: "TELEGRAM_NOT_CONFIGURED",
        message: "TELEGRAM_BOT_TOKEN не задан",
      });
    }

    const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
    if (secret) {
      const header = request.headers["x-telegram-bot-api-secret-token"];
      if (header !== secret) {
        return reply.status(401).send({
          code: "UNAUTHORIZED",
          message: "Неверный secret token",
        });
      }
    }

    await bot.handleUpdate(request.body as Update);
    return reply.status(200).send({ ok: true });
  });
};

/** Регистрирует handlers и команды; webhook без long polling. */
export async function setupBotMenu() {
  const bot = ensureHandlers();
  if (!bot) return;

  await bot.api.setMyCommands([
    { command: "start", description: "Главное меню" },
  ]);

  const webhookUrl = process.env.TELEGRAM_WEBHOOK_URL?.trim();
  if (webhookUrl) {
    const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
    await bot.api.setWebhook(webhookUrl, {
      secret_token: secret || undefined,
      drop_pending_updates: true,
    });
  }
}
