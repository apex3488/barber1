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

export async function startTelegramBotMode(logger: {
  info: (msg: string) => void;
  error: (err: unknown) => void;
}) {
  const bot = ensureHandlers();
  if (!bot) {
    logger.info("Telegram bot skipped: no TELEGRAM_BOT_TOKEN");
    return;
  }

  const webhookUrl = process.env.TELEGRAM_WEBHOOK_URL?.trim();
  if (webhookUrl) {
    const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
    await bot.api.setWebhook(webhookUrl, {
      secret_token: secret || undefined,
      drop_pending_updates: true,
    });
    logger.info(`Telegram webhook set: ${webhookUrl}`);
    return;
  }

  await bot.api.deleteWebhook({ drop_pending_updates: true });
  logger.info("Telegram bot started in long polling mode");
  void bot.start({
    onStart: (info) => logger.info(`Bot @${info.username} polling`),
  });
}
