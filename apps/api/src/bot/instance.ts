import { Bot } from "grammy";

let bot: Bot | null = null;
let botUsername: string | null = null;

export function getBot(): Bot | null {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return null;
  if (!bot) {
    bot = new Bot(token);
  }
  return bot;
}

export async function getBotUsername(): Promise<string | null> {
  if (botUsername) return botUsername;
  const instance = getBot();
  if (!instance) return null;
  const me = await instance.api.getMe();
  botUsername = me.username ?? null;
  return botUsername;
}
