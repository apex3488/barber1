import { InlineKeyboard } from "grammy";
import { prisma } from "../lib/prisma.js";
import { getBot } from "../bot/instance.js";
import { formatBookingWhen, formatPrice } from "../bot/format.js";
import { addMinutes } from "../lib/time.js";

export type NotificationsSummary = {
  reminderDay: number;
  reminder30m: number;
  autoCompleted: number;
  reviewRequested: number;
  errors: string[];
};

async function getNumberSetting(key: string, fallback: number) {
  const row = await prisma.setting.findUnique({ where: { key } });
  const value = Number(row?.value);
  return Number.isFinite(value) ? value : fallback;
}

async function sendHtml(
  chatId: string,
  text: string,
  keyboard?: InlineKeyboard,
) {
  const bot = getBot();
  if (!bot) throw new Error("Bot not configured");
  await bot.api.sendMessage(chatId, text, {
    parse_mode: "HTML",
    reply_markup: keyboard,
  });
}

export async function runNotificationsJob(): Promise<NotificationsSummary> {
  const summary: NotificationsSummary = {
    reminderDay: 0,
    reminder30m: 0,
    autoCompleted: 0,
    reviewRequested: 0,
    errors: [],
  };

  const now = new Date();
  const dayMinutes = await getNumberSetting("reminder_day_minutes", 1440);
  const shortMinutes = await getNumberSetting("reminder_short_minutes", 30);
  const reviewDelay = await getNumberSetting("review_delay_min", 60);

  const dayFrom = addMinutes(now, dayMinutes - 60);
  const dayTo = addMinutes(now, dayMinutes);

  const dayCandidates = await prisma.booking.findMany({
    where: {
      status: "confirmed",
      reminderDaySentAt: null,
      startsAt: { gt: now, lte: dayTo },
    },
    include: { client: true, barber: true, services: true },
  });

  for (const booking of dayCandidates.filter((b) => b.startsAt > dayFrom)) {
    try {
      const services = booking.services.map((s) => s.name).join(", ");
      if (booking.client.telegramChatId) {
        await sendHtml(
          booking.client.telegramChatId,
          [
            "<b>Напоминание о записи</b>",
            `Когда: ${formatBookingWhen(booking.startsAt)}`,
            `Услуга: ${services}`,
            `Барбер: ${booking.barber.name}`,
            `Цена: ${formatPrice(booking.totalPrice)}`,
          ].join("\n"),
        );
      }
      const updated = await prisma.booking.updateMany({
        where: { id: booking.id, reminderDaySentAt: null },
        data: { reminderDaySentAt: new Date() },
      });
      if (updated.count > 0) summary.reminderDay += 1;
    } catch (error) {
      summary.errors.push(`day:${booking.id}:${String(error)}`);
    }
  }

  const shortTo = addMinutes(now, shortMinutes);
  const shortCandidates = await prisma.booking.findMany({
    where: {
      status: "confirmed",
      reminder30mSentAt: null,
      startsAt: { gt: now, lte: shortTo },
    },
    include: { client: true, barber: true, services: true },
  });

  for (const booking of shortCandidates) {
    try {
      const services = booking.services.map((s) => s.name).join(", ");
      if (booking.client.telegramChatId) {
        await sendHtml(
          booking.client.telegramChatId,
          [
            "<b>Через 30 минут запись</b>",
            `Когда: ${formatBookingWhen(booking.startsAt)}`,
            `Услуга: ${services}`,
            `Барбер: ${booking.barber.name}`,
          ].join("\n"),
        );
      }
      const updated = await prisma.booking.updateMany({
        where: { id: booking.id, reminder30mSentAt: null },
        data: { reminder30mSentAt: new Date() },
      });
      if (updated.count > 0) summary.reminder30m += 1;
    } catch (error) {
      summary.errors.push(`30m:${booking.id}:${String(error)}`);
    }
  }

  const auto = await prisma.booking.updateMany({
    where: {
      status: "confirmed",
      endsAt: { lt: now },
      autoCompletedAt: null,
    },
    data: {
      status: "completed",
      autoCompletedAt: now,
    },
  });
  summary.autoCompleted = auto.count;

  const reviewAfter = addMinutes(now, -reviewDelay);
  const reviewCandidates = await prisma.booking.findMany({
    where: {
      status: "completed",
      reviewRequestedAt: null,
      endsAt: { lte: reviewAfter },
      review: null,
    },
    include: { client: true, barber: true, services: true },
  });

  for (const booking of reviewCandidates) {
    try {
      const services = booking.services.map((s) => s.name).join(", ");
      if (booking.client.telegramChatId) {
        const keyboard = new InlineKeyboard()
          .text("1", `review:${booking.id}:1`)
          .text("2", `review:${booking.id}:2`)
          .text("3", `review:${booking.id}:3`)
          .text("4", `review:${booking.id}:4`)
          .text("5", `review:${booking.id}:5`);
        await sendHtml(
          booking.client.telegramChatId,
          [
            "<b>Как прошёл визит?</b>",
            `Барбер: ${booking.barber.name}`,
            `Услуга: ${services}`,
            "Оцените от 1 до 5:",
          ].join("\n"),
          keyboard,
        );
      }
      const updated = await prisma.booking.updateMany({
        where: { id: booking.id, reviewRequestedAt: null },
        data: { reviewRequestedAt: new Date() },
      });
      if (updated.count > 0) summary.reviewRequested += 1;
    } catch (error) {
      summary.errors.push(`review:${booking.id}:${String(error)}`);
    }
  }

  return summary;
}
