import { config } from "dotenv";
import { resolve } from "node:path";
import { buildApp } from "./app.js";
import { setupBotMenu } from "./routes/telegram.js";

config({ path: resolve(process.cwd(), ".env") });
config({ path: resolve(process.cwd(), "../../.env") });

const app = await buildApp();

try {
  await app.listen({
    host: "0.0.0.0",
    port: Number(process.env.PORT ?? 3011),
  });
  app.log.info(
    `API listening on http://localhost:${Number(process.env.PORT ?? 3011)}`,
  );
} catch (error) {
  app.log.error(error);
  process.exit(1);
}

try {
  await setupBotMenu();
} catch (error) {
  app.log.error(error);
}
