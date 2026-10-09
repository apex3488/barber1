import { Bot, InlineKeyboard, Keyboard } from "grammy";
import { prisma } from "../lib/prisma.js";
import { formatBookingWhen, formatPrice } from "./format.js";
import { consumeBarberLinkCode } from "../services/barberLinks.js";

function mainKeyboard(miniAppUrl?: string) {
  const keyboard = new Keyboard()
    .text("📅 Записаться")
    .text("📋 Мои записи")
    .row()
    .text("ℹ️ Помощь")
    .resized();

  if (miniAppUrl?.startsWith("https://")) {
    return {
      reply: keyboard,
      inline: new InlineKeyboard().webApp("Открыть Mini App", miniAppUrl),
    };
  }

  return { reply: keyboard, inline: undefined };
}

async function linkClient(telegramId: number, chatId: number, name: string) {
  const id = String(telegramId);
  const existing = await prisma.client.findUnique({ where: { telegramId: id } });
  if (existing) {
    return prisma.client.update({
      where: { id: existing.id },
      data: { telegramChatId: String(chatId), name: existing.name || name },
    });
  }
  return prisma.client.create({
    data: {
      name,
      phone: `tg:${id}`,
      telegramId: id,
      telegramChatId: String(chatId),
    },
  });
}

async function showMyBookings(chatId: number, telegramId: number, bot: Bot) {
  const client = await prisma.client.findUnique({
    where: { telegramId: String(telegramId) },
  });
  if (!client) {
    await bot.api.sendMessage(chatId, "Сначала нажмите /start");
    return;
  }

  const bookings = await prisma.booking.findMany({
    where: { clientId: client.id, status: "confirmed" },
    orderBy: { startsAt: "asc" },
    include: { barber: true, services: true },
    take: 10,
  });

  if (bookings.length === 0) {
    await bot.api.sendMessage(chatId, "Активных записей пока нет.");
    return;
  }

  for (const booking of bookings) {
    const services = booking.services.map((s) => s.name).join(", ");
    await bot.api.sendMessage(
      chatId,
      [
        `<b>${formatBookingWhen(booking.startsAt)}</b>`,
        `${services}`,
        `Барбер: ${booking.barber.name}`,
        `Цена: ${formatPrice(booking.totalPrice)}`,
        `Код: <code>${booking.manageToken.slice(0, 10)}…</code>`,
      ].join("\n"),
      { parse_mode: "HTML" },
    );
  }
}

export function registerBotHandlers(bot: Bot) {
  const miniAppUrl = process.env.MINIAPP_URL;

  bot.command("start", async (ctx) => {
    const from = ctx.from;
    if (!from) return;

    const name = [from.first_name, from.last_name].filter(Boolean).join(" ");
    await linkClient(from.id, ctx.chat.id, name || `Telegram ${from.id}`);

    const payload = ctx.match?.trim() ?? "";

    if (payload.startsWith("b_")) {
      const token = payload.slice(2);
      const booking = await prisma.booking.findUnique({
        where: { manageToken: token },
        include: { barber: true, services: true, client: true },
      });

      if (!booking) {
        await ctx.reply("Запись по этой ссылке не найдена.");
        return;
      }

      await prisma.client.update({
        where: { id: booking.clientId },
        data: {
          telegramId: String(from.id),
          telegramChatId: String(ctx.chat.id),
        },
      });

      const services = booking.services.map((s) => s.name).join(", ");
      await ctx.reply(
        [
          "<b>Запись привязана к вашему Telegram</b>",
          `Услуга: ${services}`,
          `Барбер: ${booking.barber.name}`,
          `Когда: ${formatBookingWhen(booking.startsAt)}`,
          `Статус: ${booking.status}`,
        ].join("\n"),
        { parse_mode: "HTML", reply_markup: mainKeyboard(miniAppUrl).reply },
      );
      return;
    }

    if (payload.startsWith("barber_")) {
      const code = payload.slice("barber_".length);
      try {
        const barber = await consumeBarberLinkCode(code, String(ctx.chat.id));
        await ctx.reply(
          `Готово! Барбер <b>${barber.name}</b> привязан к этому чату. Вы будете получать уведомления о записях.`,
          { parse_mode: "HTML", reply_markup: mainKeyboard(miniAppUrl).reply },
        );
      } catch (error) {
        await ctx.reply(
          error instanceof Error
            ? error.message
            : "Не удалось привязать барбера",
        );
      }
      return;
    }

    const keys = mainKeyboard(miniAppUrl);
    await ctx.reply(
      "Привет! Я бот барбершопа <b>АТЛАНТ</b>.\nМогу помочь записаться и показать ваши визиты.",
      {
        parse_mode: "HTML",
        reply_markup: keys.reply,
      },
    );
    if (keys.inline) {
      await ctx.reply("Быстрая запись:", { reply_markup: keys.inline });
    }
  });

  bot.hears("📋 Мои записи", async (ctx) => {
    if (!ctx.from) return;
    await showMyBookings(ctx.chat.id, ctx.from.id, bot);
  });

  bot.hears("📅 Записаться", async (ctx) => {
    const url = process.env.MINIAPP_URL ?? process.env.APP_URL ?? "";
    if (url.startsWith("https://")) {
      await ctx.reply("Откройте Mini App для записи:", {
        reply_markup: new InlineKeyboard().webApp("Записаться", url),
      });
      return;
    }
    await ctx.reply(
      `Для записи откройте сайт: ${process.env.APP_URL ?? "http://localhost:3000/book"}\n\nПосле деплоя Mini App кнопка появится прямо здесь.`,
    );
  });

  bot.hears("ℹ️ Помощь", async (ctx) => {
    await ctx.reply(
      [
        "Команды:",
        "/start — главное меню",
        "📅 Записаться — форма записи",
        "📋 Мои записи — ваши подтверждённые визиты",
        "",
        "Ссылку с сайта вида t.me/<bot>?start=b_<token> привязывает запись к Telegram.",
      ].join("\n"),
    );
  });

  bot.callbackQuery(/^review:(.+):([1-5])$/, async (ctx) => {
    const bookingId = ctx.match[1];
    const rating = Number(ctx.match[2]);

    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: { review: true },
    });

    if (!booking) {
      await ctx.answerCallbackQuery({ text: "Запись не найдена" });
      return;
    }
    if (booking.review) {
      await ctx.answerCallbackQuery({ text: "Отзыв уже сохранён" });
      return;
    }

    const minPublic = Number(
      (
        await prisma.setting.findUnique({
          where: { key: "review_public_min_rating" },
        })
      )?.value ?? 4,
    );

    await prisma.review.create({
      data: {
        bookingId: booking.id,
        barberId: booking.barberId,
        clientId: booking.clientId,
        rating,
        isPublic: rating >= (Number.isFinite(minPublic) ? minPublic : 4),
      },
    });

    await ctx.answerCallbackQuery({ text: "Спасибо за оценку!" });
    await ctx.editMessageText(`Спасибо! Ваша оценка: ${rating}/5`);
  });

  bot.catch((err) => {
    console.error("Bot error", err);
  });
}
