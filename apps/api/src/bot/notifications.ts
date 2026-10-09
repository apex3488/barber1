import { prisma } from "../lib/prisma.js";
import { getBot, getBotUsername } from "./instance.js";
import { formatBookingWhen, formatPrice } from "./format.js";

type BookingForNotify = {
  manageToken: string;
  startsAt: Date;
  endsAt: Date;
  totalPrice: number;
  client: { name: string; phone: string; telegramChatId: string | null };
  barber: { name: string; telegramChatId: string | null };
  services: Array<{ name: string }>;
};

async function loadBooking(id: string): Promise<BookingForNotify | null> {
  return prisma.booking.findUnique({
    where: { id },
    include: {
      client: true,
      barber: true,
      services: true,
    },
  });
}

function bookingLines(booking: BookingForNotify): string {
  const services = booking.services.map((s) => s.name).join(", ");
  return [
    `Услуга: ${services}`,
    `Барбер: ${booking.barber.name}`,
    `Когда: ${formatBookingWhen(booking.startsAt)}`,
    `Цена: ${formatPrice(booking.totalPrice)}`,
    `Клиент: ${booking.client.name} (${booking.client.phone})`,
  ].join("\n");
}

async function sendSafe(chatId: string, text: string) {
  const bot = getBot();
  if (!bot) return;
  try {
    await bot.api.sendMessage(chatId, text, { parse_mode: "HTML" });
  } catch (error) {
    console.error("Telegram send failed", chatId, error);
  }
}

export async function notifyBookingCreated(bookingId: string) {
  const booking = await loadBooking(bookingId);
  if (!booking) return;

  const username = await getBotUsername();
  const deepLink = username
    ? `\n\nУправление: https://t.me/${username}?start=b_${booking.manageToken}`
    : "";

  if (booking.client.telegramChatId) {
    await sendSafe(
      booking.client.telegramChatId,
      `<b>Запись подтверждена</b>\n${bookingLines(booking)}${deepLink}`,
    );
  }

  if (booking.barber.telegramChatId) {
    await sendSafe(
      booking.barber.telegramChatId,
      `<b>Новая запись</b>\n${bookingLines(booking)}`,
    );
  }
}

export async function notifyBookingCancelled(bookingId: string) {
  const booking = await loadBooking(bookingId);
  if (!booking) return;

  if (booking.client.telegramChatId) {
    await sendSafe(
      booking.client.telegramChatId,
      `<b>Запись отменена</b>\n${bookingLines(booking)}`,
    );
  }
  if (booking.barber.telegramChatId) {
    await sendSafe(
      booking.barber.telegramChatId,
      `<b>Клиент отменил запись</b>\n${bookingLines(booking)}`,
    );
  }
}

export async function notifyBookingRescheduled(bookingId: string) {
  const booking = await loadBooking(bookingId);
  if (!booking) return;

  if (booking.client.telegramChatId) {
    await sendSafe(
      booking.client.telegramChatId,
      `<b>Запись перенесена</b>\n${bookingLines(booking)}`,
    );
  }
  if (booking.barber.telegramChatId) {
    await sendSafe(
      booking.barber.telegramChatId,
      `<b>Запись перенесена</b>\n${bookingLines(booking)}`,
    );
  }
}
