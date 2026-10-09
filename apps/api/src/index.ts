import { config } from "dotenv";
import { resolve } from "node:path";
import { buildApp } from "./app.js";
import { startTelegramBotMode } from "./routes/telegram.js";

config({ path: resolve(process.cwd(), ".env") });
config({ path: resolve(process.cwd(), "../../.env") });

const port = Number(process.env.PORT ?? 3001);
const host = process.env.HOST ?? "0.0.0.0";

const app = await buildApp();

try {
  await app.listen({ port, host });
  app.log.info(`API listening on http://localhost:${port}`);
  await startTelegramBotMode(app.log);
} catch (error) {
  app.log.error(error);
  process.exit(1);
}
