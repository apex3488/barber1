import { randomBytes } from "node:crypto";
import { prisma } from "../lib/prisma.js";
import { badRequest, notFound } from "../lib/errors.js";
import { addMinutes } from "../lib/time.js";
import { getBotUsername } from "../bot/instance.js";

export async function createBarberLinkCode(barberId: string) {
  const barber = await prisma.barber.findUnique({ where: { id: barberId } });
  if (!barber) throw notFound("Барбер не найден");

  const code = randomBytes(6).toString("hex");
  const row = await prisma.barberLinkCode.create({
    data: {
      code,
      barberId,
      expiresAt: addMinutes(new Date(), 60 * 24), // 24 часа
    },
  });

  const username = await getBotUsername();
  const deepLink = username
    ? `https://t.me/${username}?start=barber_${code}`
    : `barber_${code}`;

  return { code: row.code, deepLink, expiresAt: row.expiresAt, barber };
}

export async function consumeBarberLinkCode(code: string, chatId: string) {
  const row = await prisma.barberLinkCode.findUnique({
    where: { code },
    include: { barber: true },
  });

  if (!row) throw badRequest("Код привязки не найден", "LINK_NOT_FOUND");
  if (row.usedAt) throw badRequest("Код уже использован", "LINK_USED");
  if (row.expiresAt < new Date()) {
    throw badRequest("Срок действия кода истёк", "LINK_EXPIRED");
  }

  await prisma.$transaction([
    prisma.barberLinkCode.update({
      where: { id: row.id },
      data: { usedAt: new Date() },
    }),
    prisma.barber.update({
      where: { id: row.barberId },
      data: { telegramChatId: chatId },
    }),
  ]);

  return row.barber;
}
