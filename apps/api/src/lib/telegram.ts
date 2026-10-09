import { createHmac, timingSafeEqual } from "node:crypto";
import { badRequest } from "./errors.js";

export type TelegramWebAppUser = {
  id: number;
  first_name?: string;
  last_name?: string;
  username?: string;
  language_code?: string;
};

export type VerifiedTelegramAuth = {
  user: TelegramWebAppUser;
  authDate: number;
  initData: string;
};

const MAX_AGE_SEC = 60 * 60 * 24; // 24 часа

function parseInitData(initData: string): URLSearchParams {
  return new URLSearchParams(initData);
}

export function verifyTelegramInitData(initData: string): VerifiedTelegramAuth {
  if (!initData?.trim()) {
    throw badRequest("Нет Telegram initData", "TELEGRAM_INIT_MISSING");
  }

  // Dev-режим без бота: initData вида "dev:123:Имя"
  if (initData.startsWith("dev:") && process.env.NODE_ENV !== "production") {
    const [, idRaw, name = "Dev User"] = initData.split(":");
    const id = Number(idRaw);
    if (!Number.isFinite(id)) {
      throw badRequest("Некорректный dev initData", "TELEGRAM_INIT_INVALID");
    }
    return {
      user: { id, first_name: name },
      authDate: Math.floor(Date.now() / 1000),
      initData,
    };
  }

  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken) {
    throw badRequest(
      "TELEGRAM_BOT_TOKEN не задан на сервере",
      "TELEGRAM_NOT_CONFIGURED",
    );
  }

  const params = parseInitData(initData);
  const hash = params.get("hash");
  if (!hash) {
    throw badRequest("В initData нет hash", "TELEGRAM_INIT_INVALID");
  }

  params.delete("hash");
  const dataCheckString = [...params.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");

  const secretKey = createHmac("sha256", "WebAppData").update(botToken).digest();
  const calculated = createHmac("sha256", secretKey)
    .update(dataCheckString)
    .digest("hex");

  const left = Buffer.from(calculated, "hex");
  const right = Buffer.from(hash, "hex");
  if (left.length !== right.length || !timingSafeEqual(left, right)) {
    throw badRequest("Подпись initData неверна", "TELEGRAM_INIT_INVALID");
  }

  const authDate = Number(params.get("auth_date") ?? 0);
  const now = Math.floor(Date.now() / 1000);
  if (!authDate || now - authDate > MAX_AGE_SEC) {
    throw badRequest("initData устарел", "TELEGRAM_INIT_EXPIRED");
  }

  const userRaw = params.get("user");
  if (!userRaw) {
    throw badRequest("В initData нет user", "TELEGRAM_INIT_INVALID");
  }

  let user: TelegramWebAppUser;
  try {
    user = JSON.parse(userRaw) as TelegramWebAppUser;
  } catch {
    throw badRequest("Некорректный user в initData", "TELEGRAM_INIT_INVALID");
  }

  if (!user?.id) {
    throw badRequest("Некорректный Telegram user", "TELEGRAM_INIT_INVALID");
  }

  return { user, authDate, initData };
}

export function telegramDisplayName(user: TelegramWebAppUser): string {
  const parts = [user.first_name, user.last_name].filter(Boolean);
  if (parts.length > 0) return parts.join(" ");
  if (user.username) return user.username;
  return `Telegram ${user.id}`;
}
