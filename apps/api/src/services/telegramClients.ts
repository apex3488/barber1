import { prisma } from "../lib/prisma.js";
import {
  telegramDisplayName,
  type TelegramWebAppUser,
} from "../lib/telegram.js";

export async function upsertTelegramClient(
  user: TelegramWebAppUser,
  phone?: string,
) {
  const telegramId = String(user.id);
  const name = telegramDisplayName(user);

  const existing = await prisma.client.findUnique({
    where: { telegramId },
  });

  if (existing) {
    return prisma.client.update({
      where: { id: existing.id },
      data: {
        name: existing.name || name,
        telegramChatId: telegramId,
        ...(phone ? { phone } : {}),
      },
    });
  }

  if (phone) {
    const byPhone = await prisma.client.findFirst({ where: { phone } });
    if (byPhone) {
      return prisma.client.update({
        where: { id: byPhone.id },
        data: {
          telegramId,
          telegramChatId: telegramId,
          name: byPhone.name || name,
        },
      });
    }
  }

  return prisma.client.create({
    data: {
      name,
      phone: phone ?? `tg:${telegramId}`,
      telegramId,
      telegramChatId: telegramId,
    },
  });
}

export async function listClientBookings(clientId: string) {
  return prisma.booking.findMany({
    where: { clientId },
    orderBy: { startsAt: "desc" },
    include: {
      barber: true,
      client: true,
      services: true,
    },
  });
}
